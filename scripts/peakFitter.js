////////////////////////////////////////////
// main setup
////////////////////////////////////////////
//
// Peak Fitter general work flow:
// Histogram directory is taken from the URL.
// User input is required for a list of peaks to fit in, a list of spectra, in a list of histogram files.
// User input can be provided a JSON script upload, or manual via text input boxes with rapid-fill assistance.
// The peakFitter will then loop through downloading the spectra for one histogram file at a time, and fit all spectra in those spectra.
// Once all peaks in all spectra in all histogram files are fitted the results are displayed in a table, and available for download.
// At the end the analysis script (JSON format) is also available for download for easy repeat of this analysis.
//
//
// Technical workflow description:
// Histogram directory is taken from the URL.
// User input is six lists for histogram filenames, 1d spectrum names, peak centroids to fit in 1d spectra, 2d spectrum names, gate limits for making projections, peak centroids to fit in 2d spectra.
// User clicks a button to launch the analysis process.
// In order to limit and reduce overall memory usage the 1d and 2d raw spectrum data will be dropped between histogram files.
// The work flow in the analysis process will be; download all spectra for first histogram file, make any projections for 2d spectra, fit all singles, fit all projections, add results to table, delete all raw data, repeat for next histogram file in list until the end of the list.
// Most apps have the download all spectra from all runs completed before starting the projections and then peak fitting. So this workflow is different because we dont know how many runfiles there will be.
// Job done.

function setupDataStore(){
  //sets up global variable datastore

  var i, groups = [];

  dataStore = {};

  //network and raw data
  dataStore.spectrumServer = 'http://grsmid00.triumf.ca:9093/';           //host + port of analyzer server
  dataStore.ODBhost = 'http://grsmid00.triumf.ca:8081/';                  //MIDAS / ODB host + port
  dataStore.ODBrequests = [];                 //request strings for odb parameters (needed by plotcontrol)

  // Histogram directory and filename
  dataStore.histoFileDirectoryPath = '/Users/garns/Work/Data';
  dataStore.histoFileName = '';
  dataStore.histoAutoLoad = false;        // Flag set by the presence of a directory and filename in the URL to automatically load it. Default is off.

  // Get the analyzer Server and ODB host names from the URL
  GetURLArguments();

  // Raw spectrum data handling
  dataStore.pageTitle = 'Peak Fitter';                                   //header title
  dataStore.rawData = {};                                                 //buffer for raw spectrum data
  dataStore.raw = [];                                                 //buffer for raw matrix data
  dataStore.matrix = [];                                                 //buffer for objects containing the uncompressed matrix data
  dataStore.hm = {};                                                 //object for 2d matrix stuff
  dataStore.hm._raw = [];                                                 //buffer for raw matrix data
  dataStore.activeMatrix = '';                                         // keep track of the current 2d spectrum
  dataStore.activeMatrixXaxisLength = 16;
  dataStore.activeMatrixYaxisLength = 16;
  dataStore.activeMatrixSymmetrized = true;
  dataStore.createdSpectra = {};                                       //initialize empty object for created spectra
	dataStore.createdBG1Spectra = {};                                    //initialize empty object for created background (BG1) spectra
  dataStore.createdBG2Spectra = {};                                    //initialize empty object for created background (BG2) spectra

  //fitting
  dataStore.ROI = {};                                                   //regions of interest to look for peaks in: 'plotname': [[low bin, high bin], [low bin, high bin], ...]
  //                                                                      dataStore.ROI[sourceKey][peakIndex] = [low bin, high bin]
  dataStore.fitResults = {};                                            //fit results: 'plotname': [[amplitude, center, width, intercept, slope, area, FWHM], [amplitude, center, width, intercept, slope, area, FWHM]]

  //custom element config
  dataStore.dataType = 'Singles';                                         //mode of operation: Singles or Addback.

  // Workflow management and progress tracking
  dataStore.currentTask = 'Setup';                   // keep track of which task we are on to determine the behaviour of certain function. Setup, Fetching, Creation, Singles, Projections, Results
  dataStore.currentHistoFileName = '';               // keep track of which file we are currently working with in the list
  dataStore.currentSpectrumIndex = 0;                           // index for the dataStore.sourceInfo while looping through sources.
  dataStore.currentPeakIndex = 0;                               // index for the dataStore.sourceInfo while looping through sources.
  dataStore.progressBarKey = "peakFitterProgress";                        // id of the Div with class = "progress-bar ..."
  dataStore.progressBarNumberTasks = 0;                             // Total count of tasks (spectra to fetch, projections to make, peaks to fit) for use with the progress bar
  dataStore.progressBarTasksCompleted = 0;                           // Number of tasks completed so far for use with the progress bar

  // Script configuration - all are arrays used only as user input
  // The 'peakFitterScript' can be provided by the user as an upload and will be copied into this 'dataStore.peakFitterScript' object
  dataStore.peakFitterScript = {
    'histogramFileNames' : [],                                // List of all the histogram files
    'spectrumList1d' : [],                                    // Names of all the 1d spectra
    'spectrumList1dPeaks' : [],                               // List of all peak centroids to be fitted in the 1d spectra
    'spectrumList2d' : [],                                    // Names of all the 2d spectra
    'spectrumListGates' : [[],[]],                            // List of all the gate limits to make projections from the 2d spectra, [[low bin, high bin], [low bin, high bin], ...]
    'spectrumListProjectionsPeaks' : []                      // List of all peak centroids to be fitted in the projected 1d spectra from the 2d spectra
  };

  // Actual lists of arrays and objects used in workflow
  // Lists for the histogram filenames, 1d spectrum names, peak centroids to fit in 1d spectra, 2d spectrum names, gate limits for making projections, peak centroids to fit in 2d spectra.
  dataStore.spectrumListHistoFileNames = [];                        // List of all the histogram files
  dataStore.spectrumListHistoFileDetails = {};                      // List of objects containing the run details of the histogram files
  dataStore.spectrumList1d = [];                                    // List of all the 1d spectra
  dataStore.spectrumList1dPeaks = {};                               // List of all peaks to fit in the 1d spectra
                                      // Format for peaks: 'spectrumname': [1173,1332.0], ...]
  dataStore.spectrumList2d = [];                                    // List of all the 2d spectra
  dataStore.spectrumListGates = {};                                 // List of all the gate limits for the 2d spectra,
                                   // Format for gates: 'matrixname': [[axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max], [], ...]
  dataStore.spectrumListProjections = [];                           // List of all 1d projections from the 2d spectra
  dataStore.spectrumListProjectionsPeaks = {};                      // List of all peaks to fit in the projected 1d spectra from 2d spectra
                                      // Format for peaks: 'projectionname': [1173,1332.0], ...]
  dataStore.numRunFiles = 0;
  dataStore.num1dSpectra = 0;
  dataStore.num1dPeaks = 0;
  dataStore.num2dSpectra = 0;
  dataStore.num2dGates = 0;
  dataStore.num2dPeaks = 0;

  dataStore.plots = ['Spectra'];                                          //names of plotGrid cells and spectrumViewer objects
  dataStore.cellIndex = dataStore.plots.length;

// Test example setup
dataStore.peakFitterScript = {
  'histogramFileNames' : [],                                // List of all the histogram files
  'spectrumList1d' : [],                                    // Names of all the 1d spectra
  'spectrumList1dPeaks' : [],                               // List of all peak centroids to be fitted in the 1d spectra
  'spectrumList2d' : [],                                    // Names of all the 2d spectra
  'spectrumListGates' : [],
                                                                // List of all the gate limits to make projections from the 2d spectra,
                                                                  // Format for gates: 'matrixname': [[axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max], [], ...]
  'spectrumListProjectionsPeaks' : []                      // List of all peak centroids to be fitted in the projected 1d spectra from the 2d spectra
};

//receiveScript(JSON.stringify(dataStore.peakFitterScript));

console.log(dataStore);
}
setupDataStore();

function receiveScript(payload){

  // Copy the payload into the local json object
  // Should do fornat error checking here
  document.getElementById('error-messages-for-drop-area').innerHTML = "";
  try{
    dataStore.peakFitterScript = JSON.parse(payload);
  }
  catch(err){
    document.getElementById('error-messages-for-drop-area').innerHTML = "Format error in json script!\n" + err;
  }

  // Actual lists of arrays and objects used in workflow
  // Lists for the histogram filenames, 1d spectrum names, peak centroids to fit in 1d spectra, 2d spectrum names, gate limits for making projections, peak centroids to fit in 2d spectra.
  dataStore.spectrumListHistoFileNames = dataStore.peakFitterScript.histogramFileNames;  // List of all the histogram files
  dataStore.spectrumList1d = dataStore.peakFitterScript.spectrumList1d;
  dataStore.spectrumList1dPeaks = dataStore.peakFitterScript.spectrumList1dPeaks;   // List of all peaks to fit in the 1d spectra
  dataStore.spectrumList2d = dataStore.peakFitterScript.spectrumList2d;
  for(var i=0; i<dataStore.peakFitterScript.spectrumList2d.length; i++){
    dataStore.spectrumListGates[dataStore.peakFitterScript.spectrumList2d[i]] = [];

    for(var j=0; j<dataStore.peakFitterScript.spectrumListGates.length; j++){
      dataStore.spectrumListGates[dataStore.peakFitterScript.spectrumList2d[i]].push( dataStore.peakFitterScript.spectrumListGates[j]);
    }
  }
  dataStore.spectrumListProjections = []; // Will be populated later
  dataStore.spectrumListProjectionsPeaks = dataStore.peakFitterScript.spectrumListProjectionsPeaks;                      // List of all peaks to fit in the projected 1d spectra from 2d spectra

  // In the Peaks object:
  // A key of "All" will add that list of peaks to all spectrum names for all histogram files.
  // A key of "spectrumName" will add that list of peaks to all spectra with the given name for all histogram files.
  // A key of "histogramName" will add that list of peaks to all spectra for the given histogram filename.
  // A key of "histogramName:spectrumName" will add the list of peaks to a single spectrum of a single histogram name.
  // Check the peaks object for the keyword "All". If this is present, create an entry for all spectra with this set of peaks
  if(dataStore.spectrumList1dPeaks.hasOwnProperty("All") || dataStore.spectrumList1dPeaks.hasOwnProperty("all")){
    console.log("1d peaks have the All key");
    // Start with an All list in ascending order
    dataStore.spectrumList1dPeaks["All"].sort(function(a, b){return a-b});

    // Look through the list of histogram names
    for(var fileNameIndex=0; fileNameIndex<dataStore.spectrumListHistoFileNames.length; fileNameIndex++){
      // Loop through the list of all 1d spectra
      for(var i=0; i<dataStore.spectrumList1d.length; i++){
        var spectrumKey = dataStore.spectrumListHistoFileNames[fileNameIndex].split(".")[0] + ":" + dataStore.spectrumList1d[i];
        if(!dataStore.spectrumList1dPeaks.hasOwnProperty(spectrumKey)){
          // A key for this spectrum name does not exist. Create it now and populate the array with the All peaks.
          dataStore.spectrumList1dPeaks[spectrumKey] = [];
        }

        // Add the peaks specified for this spectrum name in all files, if that exists.
        if(dataStore.spectrumList1dPeaks.hasOwnProperty(dataStore.spectrumList1d[i])){
          dataStore.spectrumList1dPeaks[spectrumKey].push(...dataStore.spectrumList1dPeaks[dataStore.spectrumList1d[i]]);
        }

        // Also add the peaks specified for this histogram file name, if that exists.
        if(dataStore.spectrumList1dPeaks.hasOwnProperty(spectrumKey.split(":")[0])){
          dataStore.spectrumList1dPeaks[spectrumKey].push(...dataStore.spectrumList1dPeaks[spectrumKey.split(":")[0]]);
        }

        // A key already exists for this spectrum name, so add the All peaks to this array containing unique peaks
        dataStore.spectrumList1dPeaks[spectrumKey].push(...dataStore.spectrumList1dPeaks["All"]);

        // Remove any duplicate values. This seems to be easier than checking before pushing the other lists.
        dataStore.spectrumList1dPeaks[spectrumKey] = [...new Set(dataStore.spectrumList1dPeaks[spectrumKey])];

        // Sort the Array now we have added more peaks
        dataStore.spectrumList1dPeaks[spectrumKey].sort(function(a, b){return a-b});
      }
    }
  }

  // The projectionsPeaks object will be filled after the projections are made. Here just sort the list.
  if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty("All") || dataStore.spectrumListProjectionsPeaks.hasOwnProperty("all")){
    console.log("Projections peaks have the All key");
    // Start with an All list in ascending order
    dataStore.spectrumListProjectionsPeaks["All"].sort(function(a, b){return a-b});
  }

  // Now populate the user input boxes from this json script
  document.getElementById('inputHistogramFiles').value = dataStore.peakFitterScript.histogramFileNames;
  document.getElementById('input1dSpectrumNames').value = dataStore.peakFitterScript.spectrumList1d;
  document.getElementById('input1dPeaks').value = dataStore.peakFitterScript.spectrumList1dPeaks["All"];
  document.getElementById('input2dSpectrumNames').value = dataStore.peakFitterScript.spectrumList2d;
  document.getElementById('input2dPeaks').value = dataStore.peakFitterScript.spectrumListProjectionsPeaks["All"];
  var gatesString = "";
  var keys = Object.keys(dataStore.spectrumListGates);
  if(keys.length>0){
    for(var i=0; i<dataStore.spectrumListGates[keys[0]].length; i++){
      if(i==0) gatesString += "[";
      if(i>0)  gatesString += "],[";
      gatesString += dataStore.spectrumListGates[keys[0]][i];
    }
    gatesString += "]";
    document.getElementById('input2dGates').value = gatesString;
  }

console.log(dataStore);
}

function receiveInputTextBoxChange(boxName,textString){
  var payload = {};
   payload = dataStore.peakFitterScript;
   console.log("receiveInputTextBoxChange, "+boxName+", "+textString);
   console.log(dataStore.peakFitterScript);

var input2key = {
"inputHistogramFiles" : "histogramFileNames",
"input1dSpectrumNames" : "spectrumList1d",
"input1dPeaks" : "spectrumList1dPeaks",
"input2dSpectrumNames" : "spectrumList2d",
"input2dGates" : "spectrumList2dGates",
"input2dPeaks" : "spectrumListProjectionsPeaks"
};

var key = input2key[boxName];

// Modify the specific section based on this text box
switch(boxName){
  case "inputHistogramFiles" :
  case "input1dSpectrumNames" :
  case "input2dSpectrumNames" :
  //var formattedString = "[" + textString + "]";
  var valuesArray = textString.split(",");
  // Insert Quotes
  payload[key] = valuesArray;
  break;
  case "input1dPeaks" :
  case "input2dPeaks" :
  var valuesArray = textString.split(",").map(Number);
  payload[key] = {"All":valuesArray};
  break;
  case "input2dGates" :
  var arraysArray = [];
  var stringsArray = textString.split("],[");
  stringsArray[0] = stringsArray[0].substring(1);
  stringsArray[stringsArray.length-1] = stringsArray[stringsArray.length-1].slice(0, -1);
  stringsArray.forEach((item, i) => {
    var itemArray = item.split(",");
    arraysArray[i] = [];
    arraysArray[i][0] = itemArray[0];
    for(var j=1; j<itemArray.length; j++){
      arraysArray[i][j] = Number(itemArray[j]);
    }
  });

  payload[key] = arraysArray;
  break;
  default: break;
}

  console.log(payload);

  receiveScript(JSON.stringify(payload));
}

function setupHistoListSelect(){
return;
      // Remove the select if it already exists
      try{
  	document.getElementById('HistoListSelect').remove();
  	document.getElementById('HistoListSelectLabel').remove();
      }
      catch(err){ }

  	// Create a select input for the histo file list
  	var newSelect = document.createElement("select");
  	newSelect.id = 'HistoListSelect';
  	newSelect.name = 'HistoListSelect';
  	newSelect.onchange = function(){
      var valueString = document.getElementById('inputHistogramFiles').value;
      if(valueString.length>1){ valueString += ","; }
       document.getElementById('inputHistogramFiles').value = valueString + this.value;
  	}.bind(newSelect);
  	document.getElementById('histo-list-menu-div').appendChild(newSelect);

  	// Add the list of histo files as the options
  	thisSelect = document.getElementById('HistoListSelect');
  	for(var j=0; j<dataStore.histoFileList.length; j++){
  	    thisSelect.add( new Option(dataStore.histoFileList[j], dataStore.histoFileList[j]) );
  	}

  	// Fire the onchange event for the select with the default value to set it
  	//document.getElementById('HistoListSelect'+thisTitle).onchange();

}

function launchPeakFittingProcess(){
  // This is the start of the automated process
  // The work flow in the analysis process will be; download all spectra for first histogram file, make any projections for 2d spectra, fit all singles, fit all projections, add results to table, delete all raw data, repeat for next histogram file in list until the end of the list.
  // The workflow in functions will be:
  // launchPeakFittingProcess() (requests first file in the list)
  // fetchCallback()
  // createAllLocalMatrices() - this is matrix unpacking into local storage - loops: createLocalMatrices(i) which loops: packZcompressed()
  // projectAllMatrices() -
  // projectionsCallback()
  // fitAllSinglesPeaks() - loops: fitSpectra()
  // fitAllProjectionsPeaks() - loops: fitSpectra()
  // fittingCallback() - calls populateReportTable(), clearLocalMemory() then if more histogram files it requests the next file.
  //
  console.log("\nlaunchPeakFittingProcess");
  console.log("Begin the auto process...");


  ////////////////
  // Set up the menus, reports and display objects
  ////////////////

  // Build the menu list
  var groups = [];

  for(i=0; i<dataStore.spectrumListHistoFileNames.length; i++){
    var histoName = dataStore.spectrumListHistoFileNames[i].split(".")[0];
    // Build the list of spectra for this histogram name
    var thesePlots = [];
    for(j=0; j<dataStore.spectrumList1d.length; j++){
      thesePlots.push(
        {
          "plotID": histoName + ":" + dataStore.spectrumList1d[j],
          "title": dataStore.spectrumList1d[j]
        });
      }
      // Build the top level dropdown for this histogram name
      groups.push({
        "groupID": histoName,
        "groupTitle": histoName,
        "plots": thesePlots
      });
    }
    dataStore.plotGroups = groups;     //groups to arrange spectra into for dropdowns

    // Generate the spectrum lists based on the list of detectors
    dataStore._plotListLite = new plotListLite('plotList');
    dataStore._plotListLite.setup();

    // Generate the peakFitter report table
    dataStore._peakFitterReport = new peakFitterReport('peakFitter');
    dataStore._peakFitterReport.setup();

    // Draw the search region
    dataStore.viewers[dataStore.plots[0]].plotData();

    ////////////////
    // Set up the progress tracking
    ////////////////

    // Save the length of the lists which are Objects for easy use later
    dataStore.numRunFiles = dataStore.spectrumListHistoFileNames.length;
    dataStore.num1dSpectra = dataStore.spectrumList1d.length;
    var keys = Object.keys(dataStore.spectrumList1dPeaks);
    for(var i=0; i<keys.length; i++){
      dataStore.num1dPeaks += dataStore.spectrumList1dPeaks[keys[i]].length;
    }
    dataStore.num2dSpectra = dataStore.spectrumList2d.length;
    var keys = Object.keys(dataStore.spectrumListGates);
    if(keys.length>0){
      dataStore.num2dGates = dataStore.spectrumListGates[keys[0]].length;
    }else{ dataStore.num2dGates = 0; }
    var keys = Object.keys(dataStore.spectrumListProjectionsPeaks);
    for(var i=0; i<keys.length; i++){
      dataStore.num2dPeaks += dataStore.spectrumListProjectionsPeaks[keys[i]].length;
    }

    // Set up the progress bar and task list
    dataStore.progressBarNumberTasks = 0;

    // Count the number of peaks for each 1d spectrum
    if(dataStore.num1dSpectra>0){
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num1dSpectra * dataStore.spectrumList1dPeaks["All"].length);
    }
console.log("Number of 1d tasks only = "+dataStore.progressBarNumberTasks);

    // Count the number of projections to make and peaks to fit in projections of each 2d spectrum
    if(dataStore.num2dSpectra>0){
      // Num of matrices to download and unpack locally...
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra);
      console.log((dataStore.numRunFiles * dataStore.num2dSpectra)+" matrices to be created locally. Total tasks = "+dataStore.progressBarNumberTasks);
      // Num of projections to make...
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates);
      console.log((dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates)+" projections to be made. Total tasks = "+dataStore.progressBarNumberTasks);
      // Total number of peaks to fit in all projections, from the "All" entry
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks["All"].length);
      console.log((dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks["All"].length)+" peaks in 'All' to be fitted. Total tasks = "+dataStore.progressBarNumberTasks);
      // Count the number of other peaks to be fitted
      for(var i=0; i<keys.length; i++){
        if(keys[i] != "All"){
          if(keys[i].includes(":") && (keys[i].includes("x-") || keys[i].includes("y-"))){
            // These peaks are specific to one projection
            dataStore.progressBarNumberTasks += dataStore.spectrumListProjectionsPeaks[keys[i]].length;
            console.log((dataStore.spectrumListProjectionsPeaks[keys[i]].length)+" peaks in individual projection ("+keys[i]+") to be fitted. Total tasks = "+dataStore.progressBarNumberTasks);
          }else if(keys[i].includes("run")){
            // These peaks are specific to one histogram file
            dataStore.progressBarNumberTasks += (dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length);
            console.log((dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length)+" peaks in one run file ("+keys[i]+") to be fitted. Total tasks = "+dataStore.progressBarNumberTasks);
          }else if(keys[i].includes("x-") || keys[i].includes("y-")){
            // These peaks are specific to one projection of one spectrum for all histogram file
            dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.spectrumListProjectionsPeaks[keys[i]].length);
            console.log((dataStore.numRunFiles * dataStore.spectrumListProjectionsPeaks[keys[i]].length)+" peaks in one projection of one spectrum for all histogram file ("+keys[i]+") to be fitted. Total tasks = "+dataStore.progressBarNumberTasks);
          }else{
            // These peaks are specific to all projections for one spectrum in all histogram files
            dataStore.progressBarNumberTasks += dataStore.numRunFiles * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length;
            console.log((dataStore.numRunFiles * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length)+" peaks in all projections of one spectrum in all run file ("+keys[i]+") to be fitted. Total tasks = "+dataStore.progressBarNumberTasks);
          }
        }
      }
    }

    console.log("Number of tasks: run files = "+dataStore.numRunFiles);
    console.log("Number of tasks: 1d peaks = "+dataStore.num1dPeaks);
    console.log("Number of tasks: 2d spectra = "+dataStore.num2dSpectra);
    console.log("Number of tasks: 2d gates = "+dataStore.num2dGates);
    console.log("Number of tasks: 2d peaks = "+dataStore.num2dPeaks);

    console.log("Number of tasks = "+dataStore.progressBarNumberTasks);

    ////////////////
    // Now set up for the start of the process
    ////////////////

    // Plug in the active spectra names for the 1d histograms
    for(var i=0; i<dataStore.spectrumList1d.length; i++){
      dataStore._plotControl.activeSpectra.push(dataStore.spectrumList1d[i]);
    }
    // Plug in the active spectra names for the 2d histograms
    for(i=0; i<dataStore.spectrumList2d.length; i++){
      dataStore._plotControl.active2dSpectra.push(dataStore.spectrumList2d[i]);
    }

    // Set the dataStore.histoFileName to this source so that constructQueries requests the correct spectrum
    dataStore.histoFileName = dataStore.currentHistoFileName = dataStore.spectrumListHistoFileNames[0];

    // Request the config file for this histogram file in order to get the details on runtime
    // First format check for the data file directory path
    var filename = dataStore.histoFileDirectoryPath;
    if(filename[filename.length]!='/'){
      filename += '/';
    }
    filename += dataStore.histoFileName;
    url = dataStore.spectrumServer + '/?cmd=viewConfig' + '&filename=' + filename;
    XHR(url, "Problem getting Config file for "+ filename +" from analyzer server", processConfigFileForRunDetails, function(error){ErrorConnectingToAnalyzerServer(error)});

    // change information message
    document.getElementById('welcomeMessage').classList.add('hidden');
    document.getElementById('fetchingMessage').classList.remove('hidden');

    // Set the current task to keep track of our progress
    dataStore.currentTask = 'Fetching';

    // Request the first histogram file from the server.
    // This launches a series of promises. Once complete we end with fetchCallback.
    dataStore._plotControl.refreshAll();

  };

  function fetchCallback(){
    console.log('\n=======================================================fetchCallback');
    console.log(dataStore);

    // Create the objects for each matrix in the local storage
    // createAllLocalMatrices(listOfMatrices,callback);
    createAllLocalMatrices(dataStore.spectrumList2d,createAllLocalMatricesCallback);

  }

  function createAllLocalMatricesCallback(){

    // Now change the DOM in preparation for peak inputs needed for projections
    console.log("\n=======================================================createAllLocalMatricesCallback");
    console.log("finished unpacking");
    console.log(dataStore);

    // change information message
    document.getElementById('fetchingMessage').classList.add('hidden');
    document.getElementById('projectionsMessage').classList.remove('hidden');

    // Set the current task to keep track of our progress
    dataStore.currentTask = 'Projections';

    // Create projectionsList for the input of the function projectAllMatrices(projectionsList)
    // projectionsList is an array of objects.
    // Each object contains the "matrixName" which is a valid key for the dataStore.matrix array.
    // Each object also contains the "gateDetails" which is an array of gates specific to that 2d spectrum.
    // Format for gates: 'matrixname': [[axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max], [], ...]
    // Where BG1SF is the Scaling Factor for a projection between bins BG1Min and BG1Max which will be subtracted from the main Gate projection between bins gateMin and gateMax onto the 'axis' axis.
    var projectionsList = [];
    var histoName = dataStore.histoFileName.split(".")[0] + ":";
    for(var i=0; i<dataStore.spectrumList2d.length; i++){
      for(var j=0; j<dataStore.spectrumListGates[dataStore.spectrumList2d[i]].length; j++){
        projectionsList.push(
          {
            "matrixName": histoName + dataStore.spectrumList2d[i],
            "gateDetails": dataStore.spectrumListGates[dataStore.spectrumList2d[i]][j]
          });
        }
      }

      // Make the projections needed from each matrix
      projectAllMatrices(projectionsList);
    }

    function projectionsCallback(){
      console.log('\n=======================================================projectionsCallback');

      console.log('Projections have been made so all spectra are ready for fitting.');
      console.log('Ready to fit all spectra');

      // Need to move these projections into the dataStore.spectrumListProjections object
      // Need to add these projections to the spectrum menu
      var keys = Object.keys(dataStore.createdSpectra);
      var histoName = dataStore.histoFileName.split(".")[0];

      for(i=0; i<keys.length; i++){
        // Only process the newly created projections for the current histogram file
        if(!keys[i].includes(histoName)){ continue; }

        // Add this projection spectrum to the list which need to be fitted
        dataStore.spectrumListProjections.push(keys[i]);

        // Create the list of peaks to fit for this projection if it does not alreayd exist.
        // If it exists it is because it has unique peaks specified for it.
        if(!dataStore.spectrumListProjectionsPeaks.hasOwnProperty(keys[i])){
          // A key for this spectrum name does not exist.
          dataStore.spectrumListProjectionsPeaks[keys[i]] = [];
        }

        // Add the list of peaks for this filename, if it exists
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(keys[i].split(":")[0])){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[keys[i].split(":")[0]]);
        }

        // Add the list of peaks for this 2d spectrum name, if it exists
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(keys[i].split(":")[1].split("x-")[0])){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[keys[i].split(":")[1].split("x-")[0]]);
        }
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(keys[i].split(":")[1].split("y-")[0])){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[keys[i].split(":")[1].split("y-")[0]]);
        }

        // Add the list of peaks for this projection name, if it exists
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(keys[i].split(":")[1])){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[keys[i].split(":")[1]]);
        }

        // Add the All peaks for projections
        dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks["All"]);

        // Remove any duplicate values. This seems to be easier than checking before pushing the other lists.
        dataStore.spectrumListProjectionsPeaks[keys[i]] = [...new Set(dataStore.spectrumListProjectionsPeaks[keys[i]])];

        // Sort the Array now we have added all peaks
        dataStore.spectrumListProjectionsPeaks[keys[i]].sort(function(a, b){return a-b});

        // Add this projection to the spectrum menu
        newMenuItem = document.createElement('li');
        newMenuItem.setAttribute('id', 'plotList'+keys[i]);
        newMenuItem.setAttribute('value', keys[i]);
        newMenuItem.setAttribute('class', 'list-group-item toggle');
        newMenuItem.innerHTML = keys[i].split(':')[1].trim()+'<span id=\'plotListbadge'+keys[i]+'\' class=\"badge plotPresence hidden\">&#x2713;</span>';
        document.getElementById('plotListplots'+histoName).appendChild(newMenuItem);
        document.getElementById('plotList'+keys[i]).onclick = function(){ dataStore._plotListLite.exclusivePlot(this.id.split('plotList')[1], dataStore.viewers[dataStore.plots[0]]); }
      }

      console.log(dataStore);

      // change information message
      document.getElementById('projectionsMessage').classList.add('hidden');
      document.getElementById('fittingSinglesMessage').classList.remove('hidden');

      // Set the current task to keep track of our progress
      dataStore.currentTask = 'SinglesFitting';

      // Build the list of spectrum names with the histogram name appended to the start of the string so it can be used as a key
      var spectrumList = [];
      dataStore.spectrumList1d.forEach((element) => spectrumList.push(histoName+":"+element));

      // Start the whole fitting routine for singles peaks
      fitPeaksInSeriesOfHistograms(spectrumList,dataStore.spectrumList1dPeaks);
    }

    function fittingCallback(){
      // All fitting has now been completed
      console.log("\n=======================================================fittingCallback");

      if(dataStore.currentTask == 'SinglesFitting'){
        // Now perform peak fitting for projections
        console.log("Now initiate projections fitting");

        // change information message
        document.getElementById('fittingSinglesMessage').classList.add('hidden');
        document.getElementById('fittingProjectionsMessage').classList.remove('hidden');

        // Set the current task to keep track of our progress
        dataStore.currentTask = 'ProjectionsFitting';

        // Create list of projections to fit for this histogram file
        var theseProjections = [];
        var histoName = dataStore.currentHistoFileName.split(".")[0];
        for(var i=0; i<dataStore.spectrumListProjections.length; i++){
          // Only process the newly created projections for the current histogram file
          if(dataStore.spectrumListProjections[i].includes(histoName)){
            theseProjections.push(dataStore.spectrumListProjections[i]);
          }
        }

        // Start the fitting routine for projections peaks for this run file
        fitPeaksInSeriesOfHistograms(theseProjections,dataStore.spectrumListProjectionsPeaks);
        return;
      }


      // Organize the results from this file into the table
      //  populateReportTable();

      // If we have not recieved the histograms from all files yet, request the histograms from the next filename
      if(dataStore.histoFileName != dataStore.spectrumListHistoFileNames[dataStore.spectrumListHistoFileNames.length-1]){
        dataStore.histoFileName = dataStore.spectrumListHistoFileNames[dataStore.spectrumListHistoFileNames.indexOf(dataStore.histoFileName)+1];
        console.log('Next histogram file to fetch: '+dataStore.histoFileName);

        // Set the dataStore.histoFileName to this source so that constructQueries requests the correct spectrum
        dataStore.currentHistoFileName = dataStore.histoFileName;

        // Request the config file for this histogram file in order to get the details on runtime
        // First format check for the data file directory path
        var filename = dataStore.histoFileDirectoryPath;
        if(filename[filename.length]!='/'){
          filename += '/';
        }
        filename += dataStore.histoFileName;
        url = dataStore.spectrumServer + '/?cmd=viewConfig' + '&filename=' + filename;
        XHR(url, "Problem getting Config file for "+ filename +" from analyzer server", processConfigFileForRunDetails, function(error){ErrorConnectingToAnalyzerServer(error)});

        // Drop as much as possible to reduce overall memory usage
        //clearLocalMemory();

        // Request spectra from the server
        dataStore._plotControl.refreshAll();
        return;
      }

      // Now we are done.
      // Reveal the download buttons
      document.getElementById('saveCSVDiv').classList.remove('hidden');
      document.getElementById('saveScriptDiv').classList.remove('hidden');
      document.getElementById('postProcessDiv').classList.remove('hidden');

      // change information message
      document.getElementById('fittingProjectionsMessage').classList.add('hidden');
      document.getElementById('reviewMessage').classList.remove('hidden');

      // Display the results in the table
      dataStore._peakFitterReport.updateTable();

      console.log(dataStore);
      console.log("Finished");
      console.log("Completed: "+dataStore.progressBarTasksCompleted+"/"+dataStore.progressBarNumberTasks+" = " + dataStore.ProgressValue);

    }


    function buildCSVfile(){
      console.log('Download initiated');
      var keys = Object.keys(dataStore.fitResults);

      // Write the table of results to a CSV file for download.
      var CSV = '';

      CSV += 'GRIFFIN Peak Fitter Results Data\n\n';

      //fit results: 'plotname': [[amplitude, center, width, intercept, slope, area, FWHM], [amplitude, center, width, intercept, slope, area, FWHM]]

      CSV += 'Histogram File,';
      CSV += 'Run Title,Run StartTime,Run Duration,';
      CSV += 'Spectrum,';
      CSV += 'Centroid,'; //
      CSV += 'Height,'; //
      CSV += 'Width,'; //
      CSV += 'Intercept (BG),'; //
      CSV += 'Slope (BG),'; //
      CSV += 'Area,'; //
      CSV += 'Area Unc.,'; //
      CSV += 'FWHM\n'; //
      for(var i=0; i<keys.length; i++){
        for(var j=0; j<dataStore.fitResults[keys[i]].length; j++){
          CSV += keys[i].split(":")[0] + ',';
          CSV += dataStore.spectrumListHistoFileDetails[keys[i].split(":")[0]].Title + ',';
          CSV += dataStore.spectrumListHistoFileDetails[keys[i].split(":")[0]].StartTime + ',';
          CSV += dataStore.spectrumListHistoFileDetails[keys[i].split(":")[0]].Duration + ',';
          CSV += keys[i].split(":")[1] + ',';
          CSV += dataStore.fitResults[keys[i]][j][1].toFixed(2) + ','; // Center
          CSV += dataStore.fitResults[keys[i]][j][0].toFixed(2) + ','; // Amplitude
          CSV += dataStore.fitResults[keys[i]][j][2].toFixed(2) + ','; // width
          CSV += dataStore.fitResults[keys[i]][j][3].toFixed(2) + ','; // intercept
          CSV += dataStore.fitResults[keys[i]][j][4].toFixed(2) + ','; // slope
          CSV += dataStore.fitResults[keys[i]][j][5].toFixed(2) + ','; // area
          CSV += Math.sqrt(dataStore.fitResults[keys[i]][j][5]).toFixed(2) + ','; // area uncertainty
          CSV += dataStore.fitResults[keys[i]][j][6].toFixed(2) + '\n'; // FWHM
        }
      }
      CSV += '\n';

      // Create a download link
      const textBlob = new Blob([CSV], {type: 'text/plain'});
      URL.revokeObjectURL(window.textBlobURL);
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(textBlob);
      downloadLink.download = 'GRIFFIN-peakFitter-Results.csv';

      // Trigger the download
      document.body.appendChild(downloadLink);
      downloadLink.click();
    }

    function buildScriptfile(){
      console.log('Download initiated');

      // Write the contents of the json script to a file for download.
      var JSONstring = '';
      JSONstring = JSON.stringify(dataStore.peakFitterScript, null, 4);

      // Need to purge some spectrum specific peak entries if they match All.


      // Create a download link
      const textBlob = new Blob([JSONstring], {type: 'text/plain'});
      URL.revokeObjectURL(window.textBlobURL);
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(textBlob);
      downloadLink.download = 'GRIFFIN-peakFitter-script.json';

      // Trigger the download
      document.body.appendChild(downloadLink);
      downloadLink.click();
    }


function postProcessPU(){
  // Post processing for 2-Hit pileup, energy2 vs energy1 as function of k.
//
// Perform linear fit of each series of projections for each 2d spectrum.
// Result y=mx+c where y = correction to E2, x=E1, m=gradient for this k value, c=intercept for this k value.
//
// Perform 6th order polynomial fit of m and c coefficients of the above.
// Result is function describing m and c as function of k.
//
var kData = [];
var mData = [];
var cData = [];

var keys = Object.keys(dataStore.fitResults);
var singleHitEnergy = dataStore.fitResults["run29578:single_hit"][1][1]; // Get the single hit centroid energy of 1332keV peak


// Perform linear fit of each series of projections for each 2d spectrum.
// Result y=mx+c where y = correction to E2, x=E1, m=gradient for this k value, c=intercept for this k value.
var thisGeindex = 1;
var GeNum = 1;
var GeString = "Ge" + alwaysThisLong(GeNum, 2);
for(var thisKvalue=10; thisKvalue<380; thisKvalue+=20){

var Kstring = "k"+thisKvalue+"x";
kData.push(thisKvalue);

    // Format the data for this detector
    var data = [];

    for(var j=0; j<keys.length; j++){
      if(keys[j].includes(Kstring)){
       // xValue is the E1 energy. Calculate from gate in the projection name
       var tail = keys[j].split(Kstring)[1];
       tail = tail.substr(1);
       var xValue = parseInt(tail.split("-")[1]-tail.split("-")[0]/2);

       // yValue is the correction required to E2
       var yValue = parseFloat(1.0-(dataStore.fitResults[keys[j]][0][1]/singleHitEnergy)+1.0);

      data.push([xValue,yValue]);
    }
    }

    // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
    const result = regression.polynomial(data, { order: 1, precision: 20 });

    // Save the fit results into the object for this detector
    mData.push(result.equation[0]);    // The coefficient of the slope term of the equation
    cData.push(result.equation[1]);  // The coefficient of the offset term of the equation
}

console.log(kData);
console.log(mData);
console.log(cData);

// Perform linear fit of each series of projections for each 2d spectrum.
// Result y=mx+c where y = correction to E2, x=E1, m=gradient for this k value, c=intercept for this k value.
console.log("Now fit the m coefficient as a function of k");
var data = [];
for(var i=0; i<kData.length; i++){
      data.push([kData[i],mData[i]]);
}

    // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
    const result_m = regression.polynomial(data, { order: 6, precision: 20 });

    console.log(result_m.equation);
    console.log(result_m.string);       //  A string representation of the equation

    console.log("Now fit the c coefficient as a function of k");
    var data = [];
    for(var i=0; i<kData.length; i++){
          data.push([kData[i],cData[i]]);
    }

        // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
        const result_c = regression.polynomial(data, { order: 6, precision: 20 });

        console.log(result_c.equation);
        console.log(result_c.string);       //  A string representation of the equation

// Save the Cstring.
// An array of the parameters for this HPGe
var Cmstring = "{"
for(var i=result_m.equation.length-1; i>=0; i--){ Cmstring += result_m.equation[i]; if(i>0){ Cmstring += ","; } }
Cmstring += "},";

var Ccstring = "{"
for(var i=result_c.equation.length-1; i>=0; i--){ Ccstring += result_c.equation[i]; if(i>0){ Ccstring += ","; } }
Ccstring += "},";

console.log(Cmstring);
console.log(Ccstring);
}

    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    /////  Drop-area handling
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////

    function setupDropArea(){
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
    }


    function processDropFile(file){

      // Set the title for the uploaded file
      document.getElementById('dropAreaTitleDiv').innerHTML = "Uploaded: \""+file.name+"\"";

      let fr = new FileReader();

      fr.onload = function(){
        console.log(fr.result);

        // Check the format is good json

        // Pass the script contents to the receive function
        receiveScript(fr.result);
        return;

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

      }

      fr.readAsText(file);
    }


    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    /////  The following functions should be made generic and moved to helpers.js for use in all future apps
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////

    // Function to save the run details from the Config file received from the server
    function processConfigFileForRunDetails(payload){
      // The run duration is required for calculating the absolute efficiency.
      // The run start date and time is required for calculating the source activity at the time of the data collection.
      // Unpack the response from the server into a local variable
      console.log(payload);
      var thisConfig = JSON.parse(payload);
      console.log(thisConfig.Analyzer[6].Midas);

      // Unpack Midas content
      var keyName = dataStore.histoFileName.split(".")[0];
      dataStore.spectrumListHistoFileDetails[keyName] = {
        'Title': thisConfig.Analyzer[6].Midas[0].Value,
        'StartTime': thisConfig.Analyzer[6].Midas[1].Value,
        'Duration': thisConfig.Analyzer[6].Midas[2].Value,
      };

    }

    // Function to increment the progressBar by the states amount
    function updateProgressBar(updateValue){

      dataStore.progressBarTasksCompleted+=parseInt(updateValue);
      dataStore.ProgressValue = (100*(dataStore.progressBarTasksCompleted/dataStore.progressBarNumberTasks)).toFixed(1);
      document.getElementById(dataStore.progressBarKey).setAttribute('style', "width:" + dataStore.ProgressValue + "%" );
      document.getElementById(dataStore.progressBarKey).innerHTML = dataStore.ProgressValue + "% complete";
      console.log("Progress value: "+dataStore.progressBarTasksCompleted+"/"+dataStore.progressBarNumberTasks+" = " + dataStore.ProgressValue);

    }

    // createAllLocalMatrices(listOfMatrices,progressBarKey,callback);
    // This function calls the function createLocalMatrices(spectrumName) and they are required together.
    // This function should be called after 2d matrices are fetched from the server.
    // Loops through the liftOfMatrices and unpacks the received content correctly.
    // Fetched 2d spectra are initially placed in dataStore.rawData object.
    // The function packZcompressed() is used to uncompress each 2d spectrum.
    // The uncompressed 2d spectrum object is placed in dataStore.matrix array,
    // and the dataStore.rawData version deleted to reduce total memory usage.
    // Input: listOfMatrices is an array. A list of 2d spectrum names.
    //        The "histoFileName:" must be added to the beginning of the name in this function for it to be used as a key for rawData.
    // Input: callback is a function to be called one the work of this function is completed.
    // Note: The progress bar will be incremented. The dataStore.progressBarKey variable must be set with the id of the div with class="progress-bar ..." and will be updated during execution of this function.
    // Note: dataStore.histoFileName must be set correctly.
    // Note: dataStore.matrix array must be declared.
    async function createAllLocalMatrices(listOfMatrices,callback){

      // Create the objects for each matrix in the local storage
      for(let i=0; i<listOfMatrices.length; i++){

        // Update the progress bar by one task
        updateProgressBar(1);

        // Process the next matrix before updating the progress bar again
        await createLocalMatrices(listOfMatrices[i]);

      } // End of for loop

      // Call the callback function
      callback();
    }


    // Works in partnership with createAllLocalMatrices(listOfMatrices,callback);
    // See notes for that function.
    async function createLocalMatrices(spectrumName){

      // Return a new promise.
      return new Promise(function(resolve) {

        // Create the new object for this matrix in the local storage
        var thisKey = dataStore.histoFileName.split(".")[0] + ":" + spectrumName;
        console.log("Creating "+thisKey);
        var thisMatrix = {
          "name" : dataStore.rawData[thisKey].name,
          "xlength" : dataStore.rawData[thisKey].XaxisLength,
          "ylength" : dataStore.rawData[thisKey].YaxisLength,
          "xmin" : dataStore.rawData[thisKey].XaxisMin,
          "ymin" : dataStore.rawData[thisKey].YaxisMin,
          "xmax" : dataStore.rawData[thisKey].XaxisMax,
          "ymax" : dataStore.rawData[thisKey].YaxisMax,
          "zmin" : dataStore.rawData[thisKey].ZaxisMin,
          "zmax" : dataStore.rawData[thisKey].ZaxisMax,
          "zminfull" : dataStore.rawData[thisKey].ZaxisMin,
          "zmaxfull" : dataStore.rawData[thisKey].ZaxisMax,
          "data" : []
        };
        dataStore.matrix[thisKey] = thisMatrix;

        // Unpack the raw data to the local storage
        // The last argument as false, suppresses the generation of a colorMap used for displaying as a heatmap
        // Unpack the compressed matrix data received from the server
        var thisMatrixData = packZcompressed(dataStore.rawData[thisKey].data2, dataStore.rawData[thisKey].XaxisLength, dataStore.rawData[thisKey].YaxisLength, dataStore.rawData[thisKey].ZaxisMax,dataStore.rawData[thisKey].symmetrized, false);

        // Trim the matrix and save it in the object
        //  dataStore.matrix[thisKey].data = trimMatrix(thisMatrixData,3);
        dataStore.matrix[thisKey].data = thisMatrixData;

        // Delete the raw version to reduce total memory usage
        delete dataStore.rawData[thisKey];

        // resolve the promise
        // This 5ms pause is necessary so that the DOM update of the progressBar actually happens during the looping.
        setTimeout(function(){resolve('Success!')},5);
      });

    }

    // projectAllMatrices(projectionsList)
    // This function calls the function createNewProjection() and they are required together.
    // This function should be called after 2d matrices have been uncompressed to local storage.
    // Loops through the projectionsList to make all requested projections from each 2d spectrum.
    // Input: projectionsList is an array of objects.
    // Each object contains the "matrixName" which is a valid key for the dataStore.matrix array.
    // Each object also contains the "gateDetails" which is an array of gates specific to that 2d spectrum.
    // Format for gates: 'matrixname': [[axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max], [], ...]
    // Where BG1SF is the Scaling Factor for a projection between bins BG1Min and BG1Max which will be subtracted from the main Gate projection between bins gateMin and gateMax onto the 'axis' axis.
    // The axis,gateMin,gateMax members are required. All others are optional.
    // Upgrade: The progressbar should be updated in this function.
    // Note: Terminates with projectionsCallback().
    function projectAllMatrices(projectionsList){
      //make the projections for the matrix of each source based on the peaks defined.
      console.log(dataStore);

      // Get the list of keys for the matrices to be projected
      matrixKeys = projectionsList;

      releaser(
        async function(i){

          // Update the progress bar by one task
         updateProgressBar(1);

          // Change rawData to another list that is just the Sum_Energy_ spectrum
          var matrixKeys = projectionsList;

          // Set the details for this matrix needed by the projectXaxis function
          var thisKey = matrixKeys[i].matrixName;
          dataStore.activeMatrix = thisKey;
          dataStore.hm._raw = dataStore.matrix[thisKey].data;

          // Set limits for the projections in this matrix
          var gateMin = matrixKeys[i].gateDetails[1];
          var gateMax = matrixKeys[i].gateDetails[2];

          // Set limits for the backgrounds to be subtracted from the projections
          var BG1SF  = matrixKeys[i].gateDetails[3];
          var BG1Min = matrixKeys[i].gateDetails[4];
          var BG1Max = matrixKeys[i].gateDetails[5];
          var BG2SF  = matrixKeys[i].gateDetails[6];
          var BG2Min = matrixKeys[i].gateDetails[7];
          var BG2Max = matrixKeys[i].gateDetails[8];

          // Now make the projection around the gate energy
          // and the associated background projections
          if(matrixKeys[i].gateDetails[0] == "x"){
            console.log("Request x axis projection of "+matrixKeys[i]);
            await createNewProjection("x",gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max);
          }else if(matrixKeys[i].gateDetails[0] == "y"){
            console.log("Request y axis projection of "+matrixKeys[i]);
            await createNewProjection("y",gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max);
          }else{
            console.log("Problem with defined axis for "+matrixKeys[i]);
          }

        }.bind(this),

        function(){
          // This code is executed only after the full list of matrixKeys has been processed by the previous function.
          projectionsCallback();

        }.bind(this),

        matrixKeys.length-1
      )
    };

    // Works in partnership with projectAllMatrices(projectionsList);
    // See notes for that function.
    // Format for inputs: axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max
    // The axis,gateMin,gateMax members are required. All others are optional and should be undefined if not requested.
    // Where BG1SF is the Scaling Factor for a projection between bins BG1Min and BG1Max which will be subtracted from the main Gate projection between bins gateMin and gateMax onto the 'axis' axis.
    async function createNewProjection(axis,min,max,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max){
      //create the projections for the gate energy and the BG1 and BG2 regions
      var i, evt, plotName;

      // Return a new promise.
      return new Promise(function(resolve) {

        // Make the gated spectrum
        console.log("Make gate projection "+min+"-"+max);
        if(axis === 'y'){
          plotName = projectYaxis(min,max,'gate');
        }else{
          plotName = projectXaxis(min,max,'gate');
        }

        // Make the BG spectra if requested
        if(typeof(BG1Min) != 'undefined'){
          if(axis === 'y'){
            plotNameBG1 = projectYaxis(BG1Min,BG1Max,'BG1',plotName);
            plotNameBG2 = projectYaxis(BG2Min,BG2Max,'BG2',plotName);
          }else{
            plotNameBG1 = projectXaxis(BG1Min,BG1Max,'BG1',plotName);
            plotNameBG2 = projectXaxis(BG2Min,BG2Max,'BG2',plotName);
          }
        }

        // Save a local copy of the gated spectrum in order to perform background subtraction
        var subtractedHistogram = dataStore.createdSpectra[plotName];

        // Subtract the first background spectrum
        if(typeof(BG1Min) != 'undefined'){
          for(var j=0; j<dataStore.createdBG1Spectra[plotName].length; j++){
            subtractedHistogram[i] -= Math.floor(dataStore.createdBG1Spectra[plotName][j]*BG1SF);
          }
        }

        // Subtract the second background spectrum
        if(typeof(BG2Min) != 'undefined'){
          for(j=0; j<dataStore.createdBG2Spectra[plotName].length; j++){
            subtractedHistogram[i] -= Math.floor(dataStore.createdBG2Spectra[plotName][j]*BG2SF);
          }
        }

        // Add this background-subtracted projection to the rawData storage for plotting
        dataStore.rawData[plotName] = subtractedHistogram;

        // Remove these items from the BG1 and BG2 objects so they are not subtracted in gammaSpectrum
        delete dataStore.createdBG1Spectra[plotName];
        delete dataStore.createdBG2Spectra[plotName];

        console.log("subtractBackground, adding "+plotName+" to rawData");

        // resolve the promise
        setTimeout(function(){resolve('Success!')},5);
      });

    };


    function fitPeaksInSeriesOfHistograms(spectra,peaks){
      //fit all spectra to the peaks defined.

      console.log(dataStore);

      // Return a new promise.
      return new Promise(function(resolve, reject) {

        // Get the list of keys
        var i, keys = spectra,
        buffer = dataStore.currentPlot //keep track of whatever was originally plotted so we can return to it

        //dump data so there is one displayed at a time
        dataStore.viewers[dataStore.plots[0]].removeData(dataStore.currentPlot);

        //set up fit callbacks
        dataStore.viewers[dataStore.plots[0]].fitCallback = fitCallback;

        releaser(
          function(i){
            // Set up the next spectra and peaks to fit
            var keys = spectra;
            var thisKey = keys[i];

            // Peak values must be integer as they represent bin/channel numbers
            var thesePeaks = [];
            for(var j=0; j<peaks[keys[i]].length; j++){
              thesePeaks.push(parseInt(peaks[keys[i]][j]));
            }

            // Update the progress bar by one task
            updateProgressBar(thesePeaks.length);

            // Call the fitting routine
            fitSpectra(thisKey,thesePeaks)
          }.bind(this),

          function(){
            var evt;
            //set up fit line re-drawing
            dataStore.viewers[dataStore.plots[0]].drawCallback = addFitLines;

            // Callback
            fittingCallback();

            // resolve the promise
            //resolve('Success!');

          }.bind(this),

          keys.length-1
        )

      }); // end of promise definition

    }


    function fitSpectra(spectrum,peaks){
      //redo the fits for the named spectrum.
      //<spectrum>: string; name of spectrum, per names from analyzer

      console.log("fitSpectra for "+spectrum);

      var peakIndex = 0;
      var viewerName = dataStore.plots[0];

      //set up fitting for this spectrum/source
      dataStore.currentPlot = spectrum;
      dataStore.viewers[viewerName].plotData() //kludge to update limits, could be nicer
      dataStore.viewers[viewerName].fitTarget = spectrum;
      dataStore._plotListLite.exclusivePlot(spectrum, dataStore.viewers[dataStore.plots[0]]);

      //locate the spectrum in the dataStore
      if(spectrum in dataStore.createdSpectra){ // true if spectrum is a key of createdSpectra
        //set up the spectrum data for fitting
        dataStore.viewers[viewerName].addData(spectrum, JSON.parse(JSON.stringify(dataStore.createdSpectra[spectrum])) );
      }else if(spectrum in dataStore.rawData){
        //set up the spectrum data for fitting
        dataStore.viewers[viewerName].addData(spectrum, JSON.parse(JSON.stringify(dataStore.rawData[spectrum])) );
      }else{
        console.log("Failed to locate spectrum data for \'"+spectrum+"\' in fitSpectra");
        return;
      }

      // Loop through the peaks to fit for this projection
      for(peakIndex=0; peakIndex<peaks.length; peakIndex++){

        // Determine the peak width for the fit region
        var thisPeakWidth = Math.ceil(typicalPeakWidth(peaks[peakIndex],"HPGe")*2);

        //set up peak fit
        console.log('fitting '+spectrum+', peak '+peakIndex);
        dataStore.currentPeak = peakIndex;
        if(!dataStore.ROI[dataStore.currentPlot]){ dataStore.ROI[dataStore.currentPlot] =[]; }
        if(!dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak]){ dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak] = []; }
        dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][0] = parseInt(peaks[peakIndex] - thisPeakWidth);
        dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][1] = parseInt(peaks[peakIndex] + thisPeakWidth);
        dataStore.viewers[viewerName].FitLimitLower = peaks[peakIndex] - thisPeakWidth;
        dataStore.viewers[viewerName].FitLimitUpper = peaks[peakIndex] + thisPeakWidth;
        dataStore.viewers[viewerName].fitData(spectrum, 0);
      }

      //dump data so it doesn't stack up
      dataStore.viewers[viewerName].removeData(spectrum);
    }


    function fitCallback(center, width, amplitude, intercept, slope){
      //after fitting, log the fit results, as well as any modification made to the ROI by the fitting algortihm
      //also update table
      //<center>: number; center of gaussian peak
      //<width>: number; width of peak
      //<amplitude>: number; amplitude of peak
      //<intercept>: number; intercept of linear background beneath peak
      //<slope>: number; slope of linear background
      console.log("fitCallback");

      var refitPeak = document.getElementById('refitPeakButton');
      var viewerName = dataStore.plots[0];

      // Calculate peak area here
      var grossArea = 0,
      netArea = 0,
      integral = 0,
      functionVals = [],
      i, x, sigmas = 5, stepSize = 0.01;
      //calculate peak area in excess of background, for <sigmas> up and down.
      for(i=0; i<2*sigmas*width/stepSize; i++){
        x = center - sigmas*width + i*stepSize
        functionVals.push( gauss(amplitude, center, width, x)*stepSize )
        integral = functionVals.integrate()
      }
      var area = parseInt(integral.toFixed(0));

      // Calculate the Full Width at Half Maximum (FWHM) here
      var fwhm = (width*2.35);

      //keep track of fit results and peak area
      console.log("Save fit results for "+dataStore.currentPlot+", "+dataStore.currentPeak);
      if(!dataStore.fitResults[dataStore.currentPlot]) dataStore.fitResults[dataStore.currentPlot] = [];
      dataStore.fitResults[dataStore.currentPlot][dataStore.currentPeak] = [amplitude, center, width, intercept, slope, area, fwhm];

      // Update the ROI in case they were modified by the fitting routine
      // DO WE NEED ROI ANY MORE? Yes, for addFitLines
      dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][0] = dataStore.viewers[viewerName].FitLimitLower;
      dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][1] = dataStore.viewers[viewerName].FitLimitUpper;

      //disengage fit mode buttons
      //if( parseInt(refitPeak.getAttribute('engaged'),10) == 1)
      //refitPeak.onclick();
    }



    function addFitLines(){
      //add current fits to the plot
      console.log('addFitLines');

      var fitLines = [];
      var viewerName = dataStore.plots[0];

      dataStore.viewers[viewerName].containerFit.removeAllChildren();

      // fitting projections for summing corrections
      console.log(dataStore);
      console.log(dataStore.ROI);
      console.log(dataStore.fitResults);
      console.log(dataStore.currentPlot);

      // Bail out of no fitResults yet
      if(!dataStore.fitResults[dataStore.currentPlot]){
        console.log('No fitResults yet for '+dataStore.currentPlot+' in addFitLines so bailing out');
        return;
      }

      // Loop through the peaks for this spectrum
      for(i=0; i<dataStore.ROI[dataStore.currentPlot].length; i++){
        //add fit lines
        console.log('Add fit lines for '+dataStore.currentPlot+', peak '+i);
        fitLines[i] = dataStore.viewers[viewerName].addFitLine(
          dataStore.ROI[dataStore.currentPlot][i][0],
          dataStore.ROI[dataStore.currentPlot][i][1] - dataStore.ROI[dataStore.currentPlot][i][0],
          dataStore.fitResults[dataStore.currentPlot][i][0],
          dataStore.fitResults[dataStore.currentPlot][i][1],
          dataStore.fitResults[dataStore.currentPlot][i][2],
          dataStore.fitResults[dataStore.currentPlot][i][3],
          dataStore.fitResults[dataStore.currentPlot][i][4]
        );

        dataStore.viewers[viewerName].containerFit.addChild(fitLines[i]);
      }

      dataStore.viewers[viewerName].stage.update();
    }
