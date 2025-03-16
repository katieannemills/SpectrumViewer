// Functions common to the gainMatcher and efficiencyFitter tools

function GetURLArguments(){
	//return an object with keys/values as per query string
	//note all values will be strings.

	var elts = {};
	var queryString = window.location.search.substring(1)
	var value, i;
        var urlData = [];


	queryString = queryString.split('&');
	for(i=0; i<queryString.length; i++){
		value = queryString[i].split('=');
		urlData[value[0]] = value[1];
	}

    // Save the information to the dataStore
    // Save the hostname and port number for getting spectrum data and writing to the config file
	  if(urlData.analyzerBackend == "localhost"){
	    dataStore.spectrumServer = 'http://'+urlData.analyzerBackend+":"+urlData.analyzerPort;
	  }else{
	    dataStore.spectrumServer = 'http://'+urlData.analyzerBackend+'.triumf.ca:'+urlData.analyzerPort;
	  }

    // Save the information to the dataStore
    // Save the hostname and port number for writing the ODB parameters
	  if(urlData.analyzerBackend == "localhost"){
	    dataStore.ODBhost = 'http://'+urlData.ODBHostBackend+":"+urlData.ODBHostPort;
	  }else{
	    dataStore.ODBhost = 'http://'+urlData.ODBHostBackend+'.triumf.ca:'+urlData.ODBHostPort;
	  }

    // Copy the histogram URL arguments to the dataStore
    dataStore.histoFileDirectoryPath = urlData.histoDir;
    if(dataStore.histoFileDirectoryPath==undefined){
	// No directory for the histogram files has been provided in the URL, so we provide a default one
	dataStore.histoFileDirectoryPath = '/tig/grifstore0b/griffin/schedule140/Histograms';
    }
    if(urlData.histoFile){
	dataStore.histoFileName = urlData.histoFile;
	dataStore.histoAutoLoad = true;
    }

}

function processHistoFileList(payload){

    // receive the payload and split into an array of strings
    var thisPayload = payload.split(" ]")[0].split("[ \n")[1];

    // tidy up the strings to extract the list of midas files
    dataStore.histoFileList = thisPayload.split(" , \n ");

    // Sort the list in numberical and alphabetical order, then reverse the order so the newer files appear first (note this is not ideal for sub-runs)
    dataStore.histoFileList.sort();
    dataStore.histoFileList.reverse();

    // Set up the list of histo files
    setupHistoListSelect();

}

function shiftclick(clickCoords){
    // callback for shift-click on plot - draw a horizontal line as the peak search region.
    // this == spectrumViewer object

    var buffer;

    // Use each shiftclick to define a small search region around a specific peak

    if(dataStore.searchRegionP1.length == 0){
        dataStore.searchRegionP1[0] =  Math.floor(clickCoords.x *0.80);
        dataStore.searchRegionP1[1] =  Math.floor(clickCoords.x *1.20);
        dataStore.searchRegionP1[2] = clickCoords.y;
        this.addLine('searchRegion', dataStore.searchRegionP1[0], dataStore.searchRegionP1[2], dataStore.searchRegionP1[1], dataStore.searchRegionP1[2], '#00FFFF');
        this.plotData();
    } else if (dataStore.searchRegionP2.length == 0){
        dataStore.searchRegionP2[0] =  Math.floor(clickCoords.x *0.80);
        dataStore.searchRegionP2[1] =  Math.floor(clickCoords.x *1.20);
        dataStore.searchRegionP2[2] = clickCoords.y;
        this.addLine('searchRegion', dataStore.searchRegionP2[0], dataStore.searchRegionP2[2], dataStore.searchRegionP2[1], dataStore.searchRegionP2[2], '#00FFFF');
        this.plotData();
    } else if (dataStore.searchRegionP3.length == 0){
        dataStore.searchRegionP3[0] =  Math.floor(clickCoords.x *0.80);
        dataStore.searchRegionP3[1] =  Math.floor(clickCoords.x *1.20);
        dataStore.searchRegionP3[2] = clickCoords.y;
        this.addLine('searchRegion', dataStore.searchRegionP3[0], dataStore.searchRegionP3[2], dataStore.searchRegionP3[1], dataStore.searchRegionP3[2], '#00FFFF');
        this.plotData();
    } else{
        dataStore.searchRegionP4[0] =  Math.floor(clickCoords.x *0.80);
        dataStore.searchRegionP4[1] =  Math.floor(clickCoords.x *1.20);
        dataStore.searchRegionP4[2] = clickCoords.y;
        this.addLine('searchRegion', dataStore.searchRegionP4[0], dataStore.searchRegionP4[2], dataStore.searchRegionP4[1], dataStore.searchRegionP4[2], '#00FFFF');
        this.plotData();

        //user guidance
        deleteNode('regionMessage');
        document.getElementById('pickerMessage').classList.remove('hidden');

	//only release the fitAll button once we have a search region defined
        document.getElementById('fitAll').classList.remove('disabled');
    }


// Need to check the ordering of the energy regions and reorder if necessary.

}

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
        var thisPeakWidth = Math.ceil(typicalPeakWidth(peaks[peakIndex],"HPGe")*5);

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
