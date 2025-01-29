////////////////////////////
// Analyzer Interface Viewer setup
////////////////////////////

function setupCalibrationsContent(){
    // function to refresh the content of the Calibrations subpage
    // Called when there is new content available
    //console.log('setupCalibrationsContent');

    // Set up event listeners for the drop area
    let dropArea = document.getElementById('drop-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDropDefaults, false)
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlightDrop, false)
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlightDrop, false)
    });

      dropArea.addEventListener('drop', handleDrop, false)

      // Populate the Config table on initial load
      refreshConfigCalibrationsContent();
}

function refreshConfigCalibrationsContent(){
//console.log(dataStore.currentCalibrations);

// Set the title for the current config
thisTimestamp = new Date(dataStore.configFileTimestamp * 1000);
document.getElementById('currentConfigCalibrationsTitleDiv').innerHTML = "<h3>Current Config file</h3>"+
    "<br>Fetched "+thisTimestamp.toString();
  // Clear the report Div
document.getElementById('currentConfigCalibrationsTableDiv').innerHTML = "";

let outputString = "";
for(let i=0; i<dataStore.currentCalibrations.length; i++)
outputString += dataStore.currentCalibrations[i].name+': '+ dataStore.currentCalibrations[i].quad+','
                + dataStore.currentCalibrations[i].gain+','+ dataStore.currentCalibrations[i].offset + "<br>";

document.getElementById('currentConfigCalibrationsTableDiv').innerHTML = outputString;
}


/////////////////
// helpers
/////////////////

function sendCalibrationsToAnalyzer(){

    //send requests
    for(let i=0; i<dataStore.CalibrationURLs.length; i++){
      XHR(dataStore.CalibrationURLs[i], 'An error occured.',
      function(){ document.getElementById('submitDivCalReport').innerHTML = "This calibration has been uploaded to the Analyzer. It is now the Current Config file."; return 0},
      function(error){console.log(error); document.getElementById('submitDivCalReport').innerHTML = "An error occured.";} );
    }

}

function processDropFile(file){

// Clear the report Div
document.getElementById('submitDivCalReport').innerHTML = "";

// Set the title
document.getElementById('calFileContentsTitleDiv').innerHTML = "<h3>Contents of Cal file</h3><br>\""+file.name+"\"";
          //    +"", "+(file.size/1000).toFixed(1)+" kB,<br>last modified "+file.lastModifiedDate+"<br>";

  let fr = new FileReader();

  fr.onload = function(){
    //  console.log(fr.result);

    // Reformat the string for display with html
    let string = fr.result.replace(/(?:\r\n|\r|\n)/g, '<br>');

    // Display the whole contents in the Div
    //document.getElementById('fileContentsDiv').innerHTML = string;

    // Split the Cal file into the different entries
    var arrStr = fr.result.split(/[{}]/);

    // Remove any extra lines; comments etc
    for(var i=0; i<arrStr.length; i++){
      if(!arrStr[i].includes("Name")){
        arrStr.splice(i, 1);
      }
    }
    //console.log(arrStr);

// Build URLs for sending to the Analyzer
    var num=0, ctr=0;
    var spectrumServer = dataStore.spectrumServer;
    dataStore.CalibrationURLs = []; // Reset the URLs
    dataStore.CalibrationURLs[num] = spectrumServer + '?cmd=setCalibration';
    let outputString = "";
    for(var i=0; i<arrStr.length; i++){
      // Split one entry into its parts
      thisArrStr = arrStr[i].split('\n');
      for(var j=0; j<thisArrStr.length; j++){
        if(thisArrStr[j].includes("Name")){
          thisName = thisArrStr[j].split(/\t| /)[1];
        }
        if(thisArrStr[j].includes("EngCoeff")){
          thisArray = thisArrStr[j].split(/\t| /);
            thisArray = thisArray.filter(String);
            thisOffset = parseFloat(thisArray[1]);
            thisGain = parseFloat(thisArray[2]);
            thisQuad = parseFloat(thisArray[3]);
          //  console.log("Using thisArray: "+thisName+': '+ thisQuad+','+ thisGain+','+ thisOffset);
        }
      }
    //  console.log(thisName+': '+ thisQuad+','+ thisGain+','+ thisOffset);
      outputString += thisName+': '+ thisQuad+','+ thisGain+','+ thisOffset + "<br>";
      // Build URL here
      // Dont allow NaN to be sent to the server
      if(isNaN(thisQuad)){ thisQuad = 0.0; }
      if(isNaN(thisGain)){ thisGain = 1.0; }
      if(isNaN(thisOffset)){ thisOffset = 0.0; }
      dataStore.CalibrationURLs[num] += '&channelName'+ctr+'='+thisName+'&quad'+ctr+'='+thisQuad+'&gain'+ctr+'='+thisGain+'&offset'+ctr+'='+thisOffset;
      ctr++;
      if(ctr%12==0){ // new URL every 12 entries
        num++; ctr=0;
        dataStore.CalibrationURLs[num] = spectrumServer + '?cmd=setCalibration';
      }
    }

  //  console.log(dataStore.CalibrationURLs);

    // Reveal the button for sending these calibrations to the Analyzer
    document.getElementById('submitCalibrationsButton').classList.remove('hidden');

    // Display the gain coefficients in the Div
    document.getElementById('calFileContentsDiv').innerHTML = outputString;
  }

  fr.readAsText(file);
}
