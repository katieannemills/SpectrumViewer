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
  dataStore.pageTitle = 'Pileup Corrections';                                   //header title
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
  dataStore.fitResultsData = {};              // Store the data of the curve fitting, 'detector-name':{ 'k1':[[x0,y0],[x1,y1]...], 'k2':[[x0,y0],[x1,y1]...], 'e1':[[x0,y0],[x1,y1]...] }
  dataStore.fitResultsParameters = {};        // Store the parameters of the curve fitting, 'detector-name':{ 'k1':[p0,p1,p2,p3,p4,p5,p6], 'k2':[p0,p1,p2,p3,p4,p5,p6], 'e1':[p0,p1,p2,p3,p4,p5,p6] }

  //custom element config
  dataStore.dataType = 'Singles';                                         //mode of operation: Singles or Addback.

  // Workflow management and progress tracking
  dataStore.currentTask = 'Setup';                   // keep track of which task we are on to determine the behaviour of certain function. Setup, Fetching, Creation, Singles, Projections, Results
  dataStore.currentHistoFileName = '';               // keep track of which file we are currently working with in the list
  dataStore.currentSpectrumIndex = 0;                           // index for the dataStore.sourceInfo while looping through sources.
  dataStore.currentPeakIndex = 0;                               // index for the dataStore.sourceInfo while looping through sources.
  dataStore.progressBarKey = "pileupCorrectionsProgress";                        // id of the Div with class = "progress-bar ..."
  dataStore.progressBarNumberTasks = 0;                             // Total count of tasks (spectra to fetch, projections to make, peaks to fit) for use with the progress bar
  dataStore.progressBarTasksCompleted = 0;                           // Number of tasks completed so far for use with the progress bar

  // Script configuration - all are arrays used only as user input
  // The 'peakFitterScript' can be provided by the user as an upload and will be copied into this 'dataStore.peakFitterScript' object
  dataStore.peakFitterScript = {
    'histogramFileNames' : [],                                // List of all the histogram files
    'spectrumList1d' : [],                                    // Names of all the 1d spectra
    'spectrumList1dPeaks' : [],                               // List of all peak centroids to be fitted in the 1d spectra
    'spectrumList2d' : [],                                    // Names of all the 2d spectra
    'spectrumListGates' : [],                                 // List of all the gate limits to make projections from the 2d spectra,
                                                              // Format for gates: 'matrixname': [[axis,gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max], [], ...]
    'spectrumListProjectionsPeaks' : []                       // List of all peak centroids to be fitted in the projected 1d spectra from the 2d spectra
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

// Declare the peakFitterScript object
dataStore.peakFitterScript = {};
dataStore.peakFitterScriptTemplate = {};

// pileup Corrections for k-dependence of 1st Hit, Ge01 only.
dataStore.peakFitterScriptTemplate["PUE1k"] = {
  "histogramFileNames" : ["run29578_nocorrections.tar"],
  "spectrumList1d" : ["Ge_Sum_Energy","single_hit"],
  "spectrumList1dPeaks" : {
                           "All": [1332]
                          },
  "spectrumList2d" : [
                      "Ge1_E_vs_k_1st_of_2hit"
                     ],
  "spectrumListGates" : [["x",0,10],
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
                      "spectrumListProjectionsPeaks" : {
                        "All":[],
                        "x-360-370":[1332],
                        "x-340-350":[1332],
                        "x-320-330":[1332],
                        "x-300-310":[1332],
                        "x-280-290":[1332],
                        "x-260-270":[1332],
                        "x-240-250":[1332],
                        "x-220-230":[1332],
                        "x-200-210":[1332],
                        "x-180-190":[1332],
                        "x-160-170":[1332],
                        "x-140-150":[1322],
                        "x-120-130":[1322],
                        "x-100-110":[1322],
                        "x-80-90":[1316],
                        "x-60-70":[1315],
                        "x-40-50":[1315],
                        "x-20-30":[1305],
                        "x-0-10":[1300]
                      }
};
// pileup Corrections for k-dependence of 1st Hit, Ge01 only.
dataStore.peakFitterScriptTemplate["PUE1k-152Eu"] = {
  "histogramFileNames" : ["run29709-no-corrections.tar"],
  "spectrumList1d" : [
                      "GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy",
                      "GRG02BN00A_Energy","GRG02GN00A_Energy","GRG02RN00A_Energy","GRG02WN00A_Energy"
                     ],
  "spectrumList1dPeaks" : {
                           //"All": [1408]
                          "All": [121]
                          },
  "spectrumList2d" : [
                      "Ge00_E_vs_k_1st_of_2hit",
                      "Ge01_E_vs_k_1st_of_2hit",
                      "Ge02_E_vs_k_1st_of_2hit",
                      "Ge03_E_vs_k_1st_of_2hit",
                      "Ge04_E_vs_k_1st_of_2hit",
                      "Ge05_E_vs_k_1st_of_2hit",
                      "Ge06_E_vs_k_1st_of_2hit",
                      "Ge07_E_vs_k_1st_of_2hit"
                     ],
  "spectrumListGates" : [["x",0,10],
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
                      "spectrumListProjectionsPeaks" : {
                      //  "All":[1395]
                        "All":[126]
                      }
};

// pileup Corrections for k-dependence of 2nd Hit, Ge01 only.
dataStore.peakFitterScriptTemplate["PUE2k-152Eu"] = {
  //"histogramFileNames" : ["run29709-k1-only-new2d.tar"],
    "histogramFileNames" : ["run29709-no-corrections.tar"],
  "spectrumList1d" : ["GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy",
                      "GRG02BN00A_Energy","GRG02GN00A_Energy","GRG02RN00A_Energy","GRG02WN00A_Energy"
                     ],
  "spectrumList1dPeaks" : {
                           "All": [121]
                          },
  "spectrumList2d" : [
                      "Ge00_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge01_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge02_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge03_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge04_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge05_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge06_PU2_E2_vs_k2_E1gated_on_Xrays",
                      "Ge07_PU2_E2_vs_k2_E1gated_on_Xrays",
                     ],
  "spectrumListGates" : [["x",0,10],
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
                      "spectrumListProjectionsPeaks" : {
                        "All":[121]
                      }
};

// pileup Corrections for 1st-Hit dependence, Ge01 only.
dataStore.peakFitterScriptTemplate["PUE2E1"] = {
  "histogramFileNames" : ["run29709-k1-k2-only.tar"],
  "spectrumList1d" : ["GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy"],
  "spectrumList1dPeaks" : {
                           "All": [121]
                          },
  "spectrumList2d" : [
    "Ge01_PU2_E2_vs_E1_k370",
    "Ge01_PU2_E2_vs_E1_k330",
    "Ge01_PU2_E2_vs_E1_k290",
    "Ge01_PU2_E2_vs_E1_k250",
    "Ge01_PU2_E2_vs_E1_k210",
    "Ge01_PU2_E2_vs_E1_k170",
    "Ge01_PU2_E2_vs_E1_k130",
    "Ge01_PU2_E2_vs_E1_k90",
    "Ge01_PU2_E2_vs_E1_k50",
    "Ge01_PU2_E2_vs_E1_k10"
                     ],
  "spectrumListGates" : [
                         ["x",1401,1411]
                        ],
  "spectrumListProjectionsPeaks" : {
    "All":[141]
                                   }
};

// pileup Corrections for 1st-Hit dependence, Ge01 only.
dataStore.peakFitterScriptTemplate["PUE2E1-alt"] = {
  //"histogramFileNames" : ["run29709-k1-k2-only.tar"],
    "histogramFileNames" : ["run29709-no-corrections-recal.tar"],
  "spectrumList1d" : ["GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy",
                      "GRG02BN00A_Energy","GRG02GN00A_Energy","GRG02RN00A_Energy","GRG02WN00A_Energy"
                     ],
  "spectrumList1dPeaks" : {
                           "All": [121]
                          },
  "spectrumList2d" : [
    "Ge00_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge01_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge02_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge03_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge04_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge05_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge06_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge07_PU2_E2_vs_k2_E1gated_on_1408keV",
                     ],
  "spectrumListGates" : [
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
  "spectrumListProjectionsPeaks" : {
    "All":[],
    "x-20-30":[142],
    "x-40-50":[142],
    "x-60-70":[138],
    "x-80-90":[138],
    "x-100-110":[136],
    "x-120-130":[135],
    "x-140-150":[135],
    "x-160-170":[135],
    "x-180-190":[135],
    "x-200-210":[135],
    "x-220-230":[130],
    "x-240-250":[130],
    "x-260-270":[130],
    "x-280-290":[130],
    "x-300-310":[130],
    "x-320-330":[130],
    "x-340-350":[130],
    "x-360-370":[130],
                                   }
};

// pileup Corrections for 1st-Hit dependence, Ge01 only.
dataStore.peakFitterScriptTemplate["PU-combined"] = {
    "histogramFileNames" : ["run29709-no-corrections.tar"],
  "spectrumList1d" : ["GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy",
                      "GRG02BN00A_Energy","GRG02GN00A_Energy","GRG02RN00A_Energy","GRG02WN00A_Energy",
                      "GRG03BN00A_Energy","GRG03GN00A_Energy","GRG03RN00A_Energy","GRG03WN00A_Energy",
                      "GRG04BN00A_Energy","GRG04GN00A_Energy","GRG04RN00A_Energy","GRG04WN00A_Energy",
                      "GRG05BN00A_Energy","GRG05GN00A_Energy","GRG05RN00A_Energy","GRG05WN00A_Energy",
                      "GRG06BN00A_Energy","GRG06GN00A_Energy","GRG06RN00A_Energy","GRG06WN00A_Energy",
                      "GRG07BN00A_Energy","GRG07GN00A_Energy","GRG07RN00A_Energy","GRG07WN00A_Energy",
                      "GRG08BN00A_Energy","GRG08GN00A_Energy","GRG08RN00A_Energy","GRG08WN00A_Energy",
                      "GRG09BN00A_Energy","GRG09GN00A_Energy","GRG09RN00A_Energy","GRG09WN00A_Energy",
                      "GRG10BN00A_Energy","GRG10GN00A_Energy","GRG10RN00A_Energy","GRG10WN00A_Energy",
                      "GRG11BN00A_Energy","GRG11GN00A_Energy","GRG11RN00A_Energy","GRG11WN00A_Energy",
                      "GRG12BN00A_Energy","GRG12GN00A_Energy","GRG12RN00A_Energy","GRG12WN00A_Energy",
                      "GRG13BN00A_Energy","GRG13GN00A_Energy","GRG13RN00A_Energy","GRG13WN00A_Energy",
                      "GRG14BN00A_Energy","GRG14GN00A_Energy","GRG14RN00A_Energy","GRG14WN00A_Energy",
                      "GRG15BN00A_Energy","GRG15GN00A_Energy","GRG15RN00A_Energy","GRG15WN00A_Energy",
                      "GRG16BN00A_Energy","GRG16GN00A_Energy","GRG16RN00A_Energy","GRG16WN00A_Energy",
                      "GRG17BN00A_Energy","GRG17GN00A_Energy","GRG17RN00A_Energy","GRG17WN00A_Energy",
                      "GRG18BN00A_Energy","GRG18GN00A_Energy","GRG18RN00A_Energy","GRG18WN00A_Energy",
                      "GRG19BN00A_Energy","GRG19GN00A_Energy","GRG19RN00A_Energy","GRG19WN00A_Energy",
                      "GRG20BN00A_Energy","GRG20GN00A_Energy","GRG20RN00A_Energy","GRG20WN00A_Energy",
                      "GRG21BN00A_Energy","GRG21GN00A_Energy","GRG21RN00A_Energy","GRG21WN00A_Energy",
                      "GRG22BN00A_Energy","GRG22GN00A_Energy","GRG22RN00A_Energy","GRG22WN00A_Energy",
                      "GRG23BN00A_Energy","GRG23GN00A_Energy","GRG23RN00A_Energy","GRG23WN00A_Energy",
                      "GRG24BN00A_Energy","GRG24GN00A_Energy","GRG24RN00A_Energy","GRG24WN00A_Energy",
                      "GRG25BN00A_Energy","GRG25GN00A_Energy","GRG25RN00A_Energy","GRG25WN00A_Energy",
                      "GRG26BN00A_Energy","GRG26GN00A_Energy","GRG26RN00A_Energy","GRG26WN00A_Energy",
                      "GRG27BN00A_Energy","GRG27GN00A_Energy","GRG27RN00A_Energy","GRG27WN00A_Energy",
                      "GRG28BN00A_Energy","GRG28GN00A_Energy","GRG28RN00A_Energy","GRG28WN00A_Energy",
                      "GRG29BN00A_Energy","GRG29GN00A_Energy","GRG29RN00A_Energy","GRG29WN00A_Energy",
                      "GRG30BN00A_Energy","GRG30GN00A_Energy","GRG30RN00A_Energy","GRG30WN00A_Energy",
                      "GRG31BN00A_Energy","GRG31GN00A_Energy","GRG31RN00A_Energy","GRG31WN00A_Energy",
                      "GRG32BN00A_Energy","GRG32GN00A_Energy","GRG32RN00A_Energy","GRG32WN00A_Energy",
                      "GRG33BN00A_Energy","GRG33GN00A_Energy","GRG33RN00A_Energy","GRG33WN00A_Energy",
                      "GRG34BN00A_Energy","GRG34GN00A_Energy","GRG34RN00A_Energy","GRG34WN00A_Energy",
                      "GRG35BN00A_Energy","GRG35GN00A_Energy","GRG35RN00A_Energy","GRG35WN00A_Energy",
                      "GRG36BN00A_Energy","GRG36GN00A_Energy","GRG36RN00A_Energy","GRG36WN00A_Energy",
                      "GRG37BN00A_Energy","GRG37GN00A_Energy","GRG37RN00A_Energy","GRG37WN00A_Energy",
                      "GRG38BN00A_Energy","GRG38GN00A_Energy","GRG38RN00A_Energy","GRG38WN00A_Energy",
                      "GRG39BN00A_Energy","GRG39GN00A_Energy","GRG39RN00A_Energy","GRG39WN00A_Energy",
                      "GRG40BN00A_Energy","GRG40GN00A_Energy","GRG40RN00A_Energy","GRG40WN00A_Energy",
                      "GRG41BN00A_Energy","GRG41GN00A_Energy","GRG41RN00A_Energy","GRG41WN00A_Energy",
                      "GRG42BN00A_Energy","GRG42GN00A_Energy","GRG42RN00A_Energy","GRG42WN00A_Energy",
                      "GRG43BN00A_Energy","GRG43GN00A_Energy","GRG43RN00A_Energy","GRG43WN00A_Energy",
                      "GRG44BN00A_Energy","GRG44GN00A_Energy","GRG44RN00A_Energy","GRG44WN00A_Energy",
                      "GRG45BN00A_Energy","GRG45GN00A_Energy","GRG45RN00A_Energy","GRG45WN00A_Energy",
                      "GRG46BN00A_Energy","GRG46GN00A_Energy","GRG46RN00A_Energy","GRG46WN00A_Energy",
                      "GRG47BN00A_Energy","GRG47GN00A_Energy","GRG47RN00A_Energy","GRG47WN00A_Energy",
                      "GRG48BN00A_Energy","GRG48GN00A_Energy","GRG48RN00A_Energy","GRG48WN00A_Energy",
                      "GRG49BN00A_Energy","GRG49GN00A_Energy","GRG49RN00A_Energy","GRG49WN00A_Energy",
                      "GRG50BN00A_Energy","GRG50GN00A_Energy","GRG50RN00A_Energy","GRG50WN00A_Energy",
                      "GRG51BN00A_Energy","GRG51GN00A_Energy","GRG51RN00A_Energy","GRG51WN00A_Energy",
                      "GRG52BN00A_Energy","GRG52GN00A_Energy","GRG52RN00A_Energy","GRG52WN00A_Energy",
                      "GRG53BN00A_Energy","GRG53GN00A_Energy","GRG53RN00A_Energy","GRG53WN00A_Energy",
                      "GRG54BN00A_Energy","GRG54GN00A_Energy","GRG54RN00A_Energy","GRG54WN00A_Energy",
                      "GRG55BN00A_Energy","GRG55GN00A_Energy","GRG55RN00A_Energy","GRG55WN00A_Energy",
                      "GRG56BN00A_Energy","GRG56GN00A_Energy","GRG56RN00A_Energy","GRG56WN00A_Energy",
                      "GRG57BN00A_Energy","GRG57GN00A_Energy","GRG57RN00A_Energy","GRG57WN00A_Energy",
                      "GRG58BN00A_Energy","GRG58GN00A_Energy","GRG58RN00A_Energy","GRG58WN00A_Energy",
                      "GRG59BN00A_Energy","GRG59GN00A_Energy","GRG59RN00A_Energy","GRG59WN00A_Energy",
                      "GRG60BN00A_Energy","GRG60GN00A_Energy","GRG60RN00A_Energy","GRG60WN00A_Energy",
                      "GRG61BN00A_Energy","GRG61GN00A_Energy","GRG61RN00A_Energy","GRG61WN00A_Energy",
                      "GRG62BN00A_Energy","GRG62GN00A_Energy","GRG62RN00A_Energy","GRG62WN00A_Energy",
                      "GRG63BN00A_Energy","GRG63GN00A_Energy","GRG63RN00A_Energy","GRG63WN00A_Energy"
                     ],
  "spectrumList1dPeaks" : {
                           "All": [121,1408]
                          },
  "spectrumList2d" : [
                      "Ge00_E_vs_k_1st_of_2hit",
                      "Ge01_E_vs_k_1st_of_2hit",
                      "Ge02_E_vs_k_1st_of_2hit",
                      "Ge03_E_vs_k_1st_of_2hit",
                      "Ge04_E_vs_k_1st_of_2hit",
                      "Ge05_E_vs_k_1st_of_2hit",
                      "Ge06_E_vs_k_1st_of_2hit",
                      "Ge07_E_vs_k_1st_of_2hit",
                      "Ge08_E_vs_k_1st_of_2hit",
                      "Ge09_E_vs_k_1st_of_2hit",
                      "Ge10_E_vs_k_1st_of_2hit",
                      "Ge11_E_vs_k_1st_of_2hit",
                      "Ge12_E_vs_k_1st_of_2hit",
                      "Ge13_E_vs_k_1st_of_2hit",
                      "Ge14_E_vs_k_1st_of_2hit",
                      "Ge15_E_vs_k_1st_of_2hit",
                      "Ge16_E_vs_k_1st_of_2hit",
                      "Ge17_E_vs_k_1st_of_2hit",
                      "Ge18_E_vs_k_1st_of_2hit",
                      "Ge19_E_vs_k_1st_of_2hit",
                      "Ge20_E_vs_k_1st_of_2hit",
                      "Ge21_E_vs_k_1st_of_2hit",
                      "Ge22_E_vs_k_1st_of_2hit",
                      "Ge23_E_vs_k_1st_of_2hit",
                      "Ge24_E_vs_k_1st_of_2hit",
                      "Ge25_E_vs_k_1st_of_2hit",
                      "Ge26_E_vs_k_1st_of_2hit",
                      "Ge27_E_vs_k_1st_of_2hit",
                      "Ge28_E_vs_k_1st_of_2hit",
                      "Ge29_E_vs_k_1st_of_2hit",
                      "Ge30_E_vs_k_1st_of_2hit",
                      "Ge31_E_vs_k_1st_of_2hit",
                      "Ge32_E_vs_k_1st_of_2hit",
                      "Ge33_E_vs_k_1st_of_2hit",
                      "Ge34_E_vs_k_1st_of_2hit",
                      "Ge35_E_vs_k_1st_of_2hit",
                      "Ge36_E_vs_k_1st_of_2hit",
                      "Ge37_E_vs_k_1st_of_2hit",
                      "Ge38_E_vs_k_1st_of_2hit",
                      "Ge39_E_vs_k_1st_of_2hit",
                      "Ge40_E_vs_k_1st_of_2hit",
                      "Ge41_E_vs_k_1st_of_2hit",
                      "Ge42_E_vs_k_1st_of_2hit",
                      "Ge43_E_vs_k_1st_of_2hit",
                      "Ge44_E_vs_k_1st_of_2hit",
                      "Ge45_E_vs_k_1st_of_2hit",
                      "Ge46_E_vs_k_1st_of_2hit",
                      "Ge47_E_vs_k_1st_of_2hit",
                      "Ge48_E_vs_k_1st_of_2hit",
                      "Ge49_E_vs_k_1st_of_2hit",
                      "Ge50_E_vs_k_1st_of_2hit",
                      "Ge51_E_vs_k_1st_of_2hit",
                      "Ge52_E_vs_k_1st_of_2hit",
                      "Ge53_E_vs_k_1st_of_2hit",
                      "Ge54_E_vs_k_1st_of_2hit",
                      "Ge55_E_vs_k_1st_of_2hit",
                      "Ge56_E_vs_k_1st_of_2hit",
                      "Ge57_E_vs_k_1st_of_2hit",
                      "Ge58_E_vs_k_1st_of_2hit",
                      "Ge59_E_vs_k_1st_of_2hit",
                      "Ge60_E_vs_k_1st_of_2hit",
                      "Ge61_E_vs_k_1st_of_2hit",
                      "Ge62_E_vs_k_1st_of_2hit",
                      "Ge63_E_vs_k_1st_of_2hit",
    "Ge00_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge01_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge02_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge03_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge04_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge05_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge06_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge07_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge08_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge09_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge00_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge01_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge02_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge03_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge04_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge05_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge06_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge07_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge08_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge09_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge10_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge11_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge12_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge13_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge14_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge15_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge16_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge17_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge18_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge19_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge20_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge21_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge22_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge23_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge24_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge25_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge26_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge27_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge28_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge29_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge30_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge31_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge32_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge33_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge34_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge35_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge36_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge37_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge38_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge39_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge40_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge41_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge42_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge43_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge44_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge45_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge46_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge47_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge48_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge49_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge50_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge51_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge52_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge53_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge54_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge55_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge56_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge57_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge58_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge59_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge60_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge61_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge62_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge63_PU2_E2_vs_k2_E1gated_on_Xrays",
"Ge10_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge11_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge12_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge13_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge14_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge15_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge16_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge17_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge18_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge19_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge20_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge21_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge22_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge23_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge24_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge25_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge26_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge27_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge28_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge29_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge30_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge31_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge32_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge33_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge34_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge35_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge36_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge37_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge38_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge39_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge40_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge41_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge42_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge43_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge44_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge45_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge46_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge47_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge48_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge49_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge50_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge51_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge52_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge53_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge54_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge55_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge56_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge57_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge58_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge59_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge60_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge61_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge62_PU2_E2_vs_k2_E1gated_on_1408keV",
"Ge63_PU2_E2_vs_k2_E1gated_on_1408keV"
                     ],
  "spectrumListGates" : [
                        ["x",0,10],
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
  "spectrumListProjectionsPeaks" : {
    "All":[1408],
    "Ge00_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge01_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge02_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge03_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge04_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge05_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge06_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge07_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge08_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge09_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge10_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge11_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge12_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge13_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge14_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge15_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge16_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge17_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge18_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge19_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge20_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge21_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge22_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge23_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge24_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge25_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge26_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge27_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge28_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge29_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge30_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge31_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge32_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge33_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge34_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge35_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge36_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge37_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge38_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge39_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge40_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge41_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge42_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge43_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge44_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge45_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge46_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge47_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge48_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge49_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge50_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge51_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge52_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge53_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge54_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge55_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge56_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge57_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge58_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge59_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge60_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge61_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge62_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge63_PU2_E2_vs_k2_E1gated_on_1408keV":[136]
                                   }
};

// pileup Corrections for 1st-Hit dependence, Ge01 only.
dataStore.peakFitterScriptTemplate["PU-combined-quick"] = {
    "histogramFileNames" : ["run29709-no-corrections.tar"],
  "spectrumList1d" : ["GRG01BN00A_Energy","GRG01GN00A_Energy","GRG01RN00A_Energy","GRG01WN00A_Energy",
                      "GRG02BN00A_Energy","GRG02GN00A_Energy","GRG02RN00A_Energy","GRG02WN00A_Energy",
                      "GRG03BN00A_Energy","GRG03GN00A_Energy","GRG03RN00A_Energy","GRG03WN00A_Energy",
                      "GRG04BN00A_Energy","GRG04GN00A_Energy","GRG04RN00A_Energy","GRG04WN00A_Energy"
                     ],
  "spectrumList1dPeaks" : {
                           "All": [121,1408]
                          },
  "spectrumList2d" : [
                      "Ge00_E_vs_k_1st_of_2hit",
                      "Ge01_E_vs_k_1st_of_2hit",
                      "Ge02_E_vs_k_1st_of_2hit",
                      "Ge03_E_vs_k_1st_of_2hit",
    "Ge00_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge01_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge02_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge03_PU2_E2_vs_k2_E1gated_on_1408keV",
    "Ge00_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge01_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge02_PU2_E2_vs_k2_E1gated_on_Xrays",
    "Ge03_PU2_E2_vs_k2_E1gated_on_Xrays"
                     ],
  "spectrumListGates" : [
                        ["x",0,10],
                        ["x",20,30],
                        ["x",40,50],
                        ["x",60,70],
                        ["x",80,90],
                        ["x",100,110],
                        ["x",120,130],
                        ["x",140,150],
                        ["x",160,170],
                        ["x",180,190],
                        ["x",200,210],
                        ["x",220,230],
                        ["x",240,250],
                        ["x",260,270],
                        ["x",280,290],
                        ["x",300,310],
                        ["x",320,330],
                        ["x",340,350],
                        ["x",360,370]
                      ],
  "spectrumListProjectionsPeaks" : {
    "All":[1408],
    "Ge00_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge01_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge02_PU2_E2_vs_k2_E1gated_on_1408keV":[136],
    "Ge03_PU2_E2_vs_k2_E1gated_on_1408keV":[136]
                                   }
};

    // Pagination for the results and plotting display
    // plotRegion = spectra
    // energyCalibrator = Table of per detector (lit En., centroids PH and En and residuals)
    // energyCalibrator = Table of all (detector num, fit params, r2)
    // graphSection = plot of per detector the PH vs Lit en with Fit and a residuals pane
    // graphSection = plot of all the residuals for specific peak
    // Variables for Pagination menu buttons
    dataStore.buttonNames = ["Spectra", "Peak-Fitting Results", "per Crystal k-dependance fits", "per Crystal 1st-Hit-dependance fits"];  // Names to appear on the buttons
    dataStore.buttonIDs = ["plotRegionMenuButton", "graphRegionMenuButton", "crystalKRegionMenuButton", "crystal1stHitRegionMenuButton"];    // IDs for the buttons
    dataStore.buttonPages = ["plotRegion", "resultsTableRegion", "crystalKReportRegion", "crystal1stHitReportRegion"];                 // Pages (div IDs) to be associated with the buttons

    // Generate THESEdetectors object. Used for building the coefficients table
    dataStore.numberOfClovers = 16;
    dataStore.THESEdetectors = [];
    var crystals = ["B","G","R","W"];
    var letter = ["A","B"];
    var num = 0;
    for(j=0; j<letter.length; j++){
      for(i=1; i<(dataStore.numberOfClovers+1); i++){
        for(k=0; k<4; k++){
          dataStore.THESEdetectors[num] = 'GRG'+alwaysThisLong(i, 2)+crystals[k]+'N00'+letter[j];
          num++;
        }
      }
    }

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

}

function receiveInputTextBoxChange(boxName,textString){
  var payload = {};
   payload = dataStore.peakFitterScript;

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

    // Generate the pileupCorrections report table
    dataStore._pileupCorrectionsReport = new pileupCorrectionsReport('pileupCorrections','crystalKReportRegionpileupCorrectionsDetector','crystal1stHitReportRegionpileupCorrectionsDetector');
    dataStore._pileupCorrectionsReport.setup();

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

    // Count the number of projections to make and peaks to fit in projections of each 2d spectrum
    if(dataStore.num2dSpectra>0){
      // Num of matrices to download and unpack locally...
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra);
      // Num of projections to make...
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates);
      // Total number of peaks to fit in all projections, from the "All" entry
      dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks["All"].length);
      // Count the number of other peaks to be fitted
      for(var i=0; i<keys.length; i++){
        if(keys[i] != "All"){
          if(keys[i].includes(":") && (keys[i].includes("x-") || keys[i].includes("y-"))){
            // These peaks are specific to one projection
            dataStore.progressBarNumberTasks += dataStore.spectrumListProjectionsPeaks[keys[i]].length;
          }else if(keys[i].includes("run")){
            // These peaks are specific to one histogram file
            dataStore.progressBarNumberTasks += (dataStore.num2dSpectra * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length);
          }else if(keys[i].includes("x-") || keys[i].includes("y-")){
            // These peaks are specific to one projection of one spectrum for all histogram file
            dataStore.progressBarNumberTasks += (dataStore.numRunFiles * dataStore.spectrumListProjectionsPeaks[keys[i]].length);
          }else{
            // These peaks are specific to all projections for one spectrum in all histogram files
            dataStore.progressBarNumberTasks += dataStore.numRunFiles * dataStore.num2dGates * dataStore.spectrumListProjectionsPeaks[keys[i]].length;
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
    // Create the objects for each matrix in the local storage
    // createAllLocalMatrices(listOfMatrices,callback);
    createAllLocalMatrices(dataStore.spectrumList2d,createAllLocalMatricesCallback);

  }

  function createAllLocalMatricesCallback(){

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
      // Need to move these projections into the dataStore.spectrumListProjections object
      // Need to add these projections to the spectrum menu
      var keys = Object.keys(dataStore.createdSpectra);
      var histoName = dataStore.histoFileName.split(".")[0];

      for(i=0; i<keys.length; i++){
        // Only process the newly created projections for the current histogram file
        if(!keys[i].includes(histoName)){ continue; }

        // Add this projection spectrum to the list which need to be fitted
        dataStore.spectrumListProjections.push(keys[i]);

        // Create the list of peaks to fit for this projection if it does not already exist.
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

        // Add the list of peaks for this projection for all 2d spectra for all filenames, if it exists
        // Projection list keys will start with either 'x' or 'y'
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(("x-"+(keys[i].split(":")[1].split("x-")[1])))){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[("x-"+(keys[i].split(":")[1].split("x-")[1]))]);
        }
        if(dataStore.spectrumListProjectionsPeaks.hasOwnProperty(("y-"+(keys[i].split(":")[1].split("y-")[1])))){
          dataStore.spectrumListProjectionsPeaks[keys[i]].push(...dataStore.spectrumListProjectionsPeaks[("y-"+(keys[i].split(":")[1].split("y-")[1]))]);
        }

        // Add the list of peaks for this specific projection name, if it exists
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

      if(dataStore.currentTask == 'SinglesFitting'){
        // Now perform peak fitting for projections

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

      // If we have not recieved the histograms from all files yet, request the histograms from the next filename
      if(dataStore.histoFileName != dataStore.spectrumListHistoFileNames[dataStore.spectrumListHistoFileNames.length-1]){
        dataStore.histoFileName = dataStore.spectrumListHistoFileNames[dataStore.spectrumListHistoFileNames.indexOf(dataStore.histoFileName)+1];

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

      // change information message
      document.getElementById('fittingProjectionsMessage').classList.add('hidden');
      document.getElementById('reviewMessage').classList.remove('hidden');

      // Display the results in the table
      dataStore._pileupCorrectionsReport.updateTable();

      console.log(dataStore);
      console.log("Finished");
      console.log("Completed: "+dataStore.progressBarTasksCompleted+"/"+dataStore.progressBarNumberTasks+" = " + dataStore.ProgressValue);

      // Reveal the post-processing buttons nad report div
      document.getElementById('postProcessDiv').classList.remove('hidden');

      // Launch the post-processing
      postProcessPUFirstHit();
    }


    function buildCSVfile(){
      console.log('Download initiated');
      var keys = Object.keys(dataStore.fitResults);
      var index = 1;

      // Write the table of results to a CSV file for download.
      var CSV = '';

      CSV += 'GRIFFIN Peak Fitter Results Data\n\n';

      //fit results: 'plotname': [[amplitude, center, width, intercept, slope, area, FWHM], [amplitude, center, width, intercept, slope, area, FWHM]]

      CSV += 'Fit Index,';
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
          CSV += index + ','; index++;
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


    function postProcessPUFirstHit(){
      // Post processing for 2-Hit pileup, 1st Hit correction as function of k.
      //
      // Perform 6th order polynomial fit of correction factor as function of k.
      // Result is function describing correction factor as function of k.

      // Inject the report card templates and setup
      var NumGe=64;

      // Get the keys from the fitResults object.
      // Get the single hit energy
      var keys = Object.keys(dataStore.fitResults);

      // Loop through all Ge crystals
      for(var thisGeindex = 0; thisGeindex<NumGe; thisGeindex++){

        console.log("\n\n==============================\n  Post-processing for pile-up, k1 dependance correction...\n\n");
          var GeString = "Ge" + alwaysThisLong(thisGeindex, 2);
          var matrixString = "_E_vs_k_1st_of_2hitx";
          var data = [];
          var Cstring = "";

        // Get the single hit centroid energy of 1408keV peak for this crystal
        // GRG01BN00A_Energy
        var crystals = ["B","G","R","W"];
        var letter = ["A","B"];
        var cloverNum = Math.floor(thisGeindex/4)+1;
        var GeName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0];
        var GeSingleSpecName = GeName + "_Energy";
        var singleHitEnergy = dataStore.fitResults[dataStore.histoFileName.split(".")[0]+":"+GeSingleSpecName][1][1]+0.5;
        console.log("SinglesEnergy for k1 of "+GeSingleSpecName+" in "+dataStore.histoFileName+" is "+singleHitEnergy);

        /////////////////////////////////////
        // Start of mapping the k1 dependence
        /////////////////////////////////////

        // Please to store this data for plotting later
        if(typeof(dataStore.fitResultsData[GeName]) == 'undefined'){
          dataStore.fitResultsData[GeName] = {};
        }
        if(typeof(dataStore.fitResultsData[GeName]['k1']) == 'undefined'){
          dataStore.fitResultsData[GeName]['k1'] = [];
        }

        // Loop over k1 values
        for(var thisKvalue=5; thisKvalue<380; thisKvalue+=20){

          // Spectrum names of the form: GeX_E_vs_k_1st_of_2hitx where X is Ge number.
          // Kstring will be the projection values in this case.
          var Kstring = "x-"+(parseInt(thisKvalue)-5)+"-"+(parseInt(thisKvalue)+5);

          for(var j=0; j<keys.length; j++){

            if(keys[j].includes(matrixString) && keys[j].includes(GeString) && keys[j].includes(Kstring)){
              // xValue is k value.
              var xValue = parseInt(thisKvalue);

              // yValue is the necessary correction to the Energy centroid to match the centroid from the single Hit spectrum
              var yValue = parseFloat(singleHitEnergy/dataStore.fitResults[keys[j]][0][1]);

              data.push([xValue,yValue]);

              // Save the data for plotting later
              dataStore.fitResultsData[GeName]['k1'].push([xValue,yValue]);
            }
          }
        } // end of k1 loop

        // Add the single hit data point. This seems to be important for getting an accurate fit.
        data.push([379,1.0]);
        dataStore.fitResultsData[GeName]['k1'].push([379,1.0]);

        console.log(data);
        // Perform polynomial fit of the series of y=correction factor as a function of x=k.
        // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
        var result = regression.polynomial(data, { order: 6, precision: 20 });

        // Save the fit parameter results for accessing and plotting later
        if(typeof(dataStore.fitResultsParameters[GeName]) == 'undefined'){
          dataStore.fitResultsParameters[GeName] = {};
        }
        dataStore.fitResultsParameters[GeName]['k1'] = result.equation.reverse();

                // Test for NaN values and correct to defaults if they are
                if(dataStore.fitResultsParameters[GeName]['k1'].every(isNaN)){
                  console.log("\n\n\n\n------------------------\n------------------------\n------------------------ isNaN \n------------------------\n------------------------\n------------------------\n\n\n");
                  dataStore.fitResultsParameters[GeName]['k1'] = [1.0,0.0,0.0,0.0,0.0,0.0,0.0];
                }


        /////////////////////////////////////
        // Start of mapping the k2 dependence
        /////////////////////////////////////
        console.log("\n\n==============================\n  Post-processing for pile-up, k2 dependance correction...\n\n");

        // Change to the 2d spectrum for k2 mapping
        var matrixString = "_PU2_E2_vs_k2_E1gated_on_Xraysx";

        // Clear the data array
        data = [];

        // Create the space for saving the data if it does not exist
        if(typeof(dataStore.fitResultsData[GeName]['k2']) == 'undefined'){
          dataStore.fitResultsData[GeName]['k2'] = [];
        }

        // Loop over k2 values
        for(var thisKvalue=5; thisKvalue<380; thisKvalue+=20){

          // Spectrum names of the form: GeX_E_vs_k_1st_of_2hitx where X is Ge number.
          // Kstring will be the projection values in this case.
          var Kstring = "x-"+(parseInt(thisKvalue)-5)+"-"+(parseInt(thisKvalue)+5);

          for(var j=0; j<keys.length; j++){

            if(keys[j].includes(matrixString) && keys[j].includes(GeString) && keys[j].includes(Kstring)){
              // xValue is k value.
              var xValue = parseInt(thisKvalue);

              // yValue is the necessary correction to the Energy centroid to match the centroid from the single Hit spectrum
              var yValue = parseFloat(singleHitEnergy/dataStore.fitResults[keys[j]][0][1]);

              data.push([xValue,yValue]);

              // Save the data for plotting later
              dataStore.fitResultsData[GeName]['k2'].push([xValue,yValue]);
              Cstring += yValue + "<br>";
            }
          }
        } // end of k2 loop

        // Add the single hit data point. This seems to be important.
        data.push([379,1.0]);
        dataStore.fitResultsData[GeName]['k2'].push([379,1.0]);

        console.log(data);
        // Perform 6th order polynomial fit of the series of y=correction factor as a function of x=k.
        // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
        result = regression.polynomial(data, { order: 6, precision: 20 });

        console.log(result.equation);
        console.log(result.string);       //  A string representation of the equation

        // Save the fit parameter results for accessing and plotting later
        dataStore.fitResultsParameters[GeName]['k2'] = result.equation.reverse();

                // Test for NaN values and correct to defaults if they are
                if(dataStore.fitResultsParameters[GeName]['k2'].every(isNaN)){
                  console.log("\n\n\n\n------------------------\n------------------------\n------------------------ isNaN \n------------------------\n------------------------\n------------------------\n\n\n");
                  dataStore.fitResultsParameters[GeName]['k2'] = [1.0,0.0,0.0,0.0,0.0,0.0,0.0];
                }


        /////////////////////////////////////
        // Start of mapping the e1 offset
        /////////////////////////////////////
        console.log("\n\n==============================\n  Post-processing for pile-up, e1 offset correction...\n\n");

                // Now get the 121keV single hit energy
                singleHitEnergy = dataStore.fitResults[dataStore.histoFileName.split(".")[0]+":"+GeSingleSpecName][0][1]+0.5;
                console.log("SinglesEnergy for k2 of "+GeSingleSpecName+" in "+dataStore.histoFileName+" is "+singleHitEnergy);

        matrixString = "_PU2_E2_vs_k2_E1gated_on_1408keVx";
        data = [];
        var kData =[];
        var mData =[];

        // Create the space for saving the data if it does not exist
        if(typeof(dataStore.fitResultsData[GeName]['e1']) == 'undefined'){
          dataStore.fitResultsData[GeName]['e1'] = [];
        }

        for(var thisKvalue=25; thisKvalue<380; thisKvalue+=20){
          // Kstring will be the projection values in this case.
          var Kstring = "x-"+(parseInt(thisKvalue)-5)+"-"+(parseInt(thisKvalue)+5);
          kData.push(thisKvalue);

          // Format the data for this detector
          for(var j=0; j<keys.length; j++){

            if(keys[j].includes(matrixString) && keys[j].includes(GeString) && keys[j].includes(Kstring)){

              // Omit failed peak fit results. Test the centroid for NaN.
              if(isNaN(dataStore.fitResults[keys[j]][0][1])){ continue; }

              // Save the fit results into the object for this detector

// First apply the k2 correction to the peak centroid.
// Then find the offset value from the calibrated single-hit centroid.
var correction = 0.0;
for(var i=0; i<result.equation.length; i++){
  correction += dataStore.fitResultsParameters[GeName]['k2'][i] * Math.pow(thisKvalue,i);
}
var correctedCentroid = dataStore.fitResults[keys[j]][0][1] * correction;

              yValue = ((singleHitEnergy-correctedCentroid)/1408.5); // This offset is a fraction of the E1 energy, here the 1408keV gate
              mData.push( yValue );  // The coefficient of the slope term of the equation

              console.log(dataStore.fitResults[keys[j]][0][1]+" corrected with "+correction+" for k="+thisKvalue+" to "+correctedCentroid+" so E1 offset = "+yValue);
            }
          }


        }

        // Perform 6th order polynomial fit of each series of m and c as a function of k.
        console.log("Now fit the m coefficient as a function of k");
        var data = [];
        for(var i=0; i<kData.length; i++){
          data.push([kData[i],mData[i]]);
          // Save the data for plotting later
          dataStore.fitResultsData[GeName]['e1'].push([kData[i],mData[i]]);
        }
        console.log(data);

        // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
        result = regression.polynomial(data, { order: 6, precision: 20 });

        console.log(result.equation);
        console.log(result.string);       //  A string representation of the equation

        // Save the fit parameter results for accessing and plotting later
        dataStore.fitResultsParameters[GeName]['e1'] = result.equation.reverse();

        // Test for NaN values and correct to defaults if they are
        if(dataStore.fitResultsParameters[GeName]['e1'].every(isNaN)){
          console.log("\n\n\n\n------------------------\n------------------------\n------------------------ isNaN \n------------------------\n------------------------\n------------------------\n\n\n");
          dataStore.fitResultsParameters[GeName]['e1'] = [0.0,0.0,0.0,0.0,0.0,0.0,0.0];
        }

      } // end of Ge loop

// Construct the C array string
          var Cstring = "";
      // Loop through all Ge crystals
      for(var thisGeindex = 0; thisGeindex<NumGe; thisGeindex++){
        Cstring += "{";

        // Get the single hit centroid energy of 1408keV peak for this crystal
        // GRG01BN00A_Energy
        var crystals = ["B","G","R","W"];
        var letter = ["A","B"];
        var cloverNum = Math.floor(thisGeindex/4)+1;
        var GeName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0];

        for(var i=0; i<dataStore.fitResultsParameters[GeName]['k1'].length; i++){
          if(i>0){ Cstring += ",";  }
          if(isNaN(dataStore.fitResultsParameters[GeName]['k1'][i])){
            Cstring += (i==1) ? 1.0 : 0.0;
          }else{
            Cstring += dataStore.fitResultsParameters[GeName]['k1'][i];
          }
        }
        Cstring += "},<br>\n";
      } // end of Ge loop

      Cstring += "<br>\n";

  // Loop through all Ge crystals
  for(var thisGeindex = 0; thisGeindex<NumGe; thisGeindex++){
    Cstring += "{";

    // Get the single hit centroid energy of 1408keV peak for this crystal
    // GRG01BN00A_Energy
    var crystals = ["B","G","R","W"];
    var letter = ["A","B"];
    var cloverNum = Math.floor(thisGeindex/4)+1;
    var GeName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0];

    for(var i=0; i<dataStore.fitResultsParameters[GeName]['k2'].length; i++){
      if(i>0){ Cstring += ",";  }
      if(isNaN(dataStore.fitResultsParameters[GeName]['k2'][i])){
        Cstring += (i==1) ? 1.0 : 0.0;
      }else{
        Cstring += dataStore.fitResultsParameters[GeName]['k2'][i];
      }
    }
    Cstring += "},<br>\n";
  } // end of Ge loop
  Cstring += "<br>\n";

// Loop through all Ge crystals
for(var thisGeindex = 0; thisGeindex<NumGe; thisGeindex++){
Cstring += "{";

// Get the single hit centroid energy of 1408keV peak for this crystal
// GRG01BN00A_Energy
var crystals = ["B","G","R","W"];
var letter = ["A","B"];
var cloverNum = Math.floor(thisGeindex/4)+1;
var GeName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0];

for(var i=0; i<dataStore.fitResultsParameters[GeName]['e1'].length; i++){
  if(i>0){ Cstring += ",";  }
  if(isNaN(dataStore.fitResultsParameters[GeName]['e1'][i])){
    Cstring += 0.0;
  }else{
    Cstring += dataStore.fitResultsParameters[GeName]['e1'][i];
  }
}
Cstring += "},<br>\n";
} // end of Ge loop
      document.getElementById("postProcessResults").innerHTML = Cstring + "<br>";

      console.log(dataStore);


            // Create the Launch Submit button to begin the process
            newButton = document.createElement('button');
            newButton.setAttribute('id', 'analyzerSubmitButton');
            newButton.setAttribute('class', 'btn btn-default btn-lg');
            newButton.innerHTML = "Write Pileup Corrections to Analyzer";
            newButton.style.padding = '4px';
            newButton.onclick = function(){
              updateAnalyzer();
            }.bind(newButton);
            document.getElementById('postProcessResults').appendChild(newButton);

    }


    function updateAnalyzer(){

      // For the ODB it first grabs the PSB table and then sets values only for the channels that are defined there.
      // For the Analyzer we can get a similar list from the viewConfig command with the Histogram file as the argument.
      // That should probably be done for the building of the initial spectrum list for gain-matching if Histogram mode is selected.
      // Need to reformat the URLs generated here for the Analyzer

      // bail out if there's no fit parameters yet
      if(Object.keys(dataStore.fitResultsParameters).length == 0)
      return;

      var NumGe = 64;
      var  gain =[], offset = [], quad = [];
      var i, j=0, q, g, o, num=0, position, urls = [];
      var crystals = ["B","G","R","W"];
      var letter = ["A","B"];

      //for every channel, update the three pileup arrays of parameters:
            // Loop through all Ge crystals
            for(var thisGeindex = 0; thisGeindex<NumGe; thisGeindex++){

            // Start this url, a separate one for each crystal
            urls[num]= dataStore.spectrumServer + '?cmd=setPileupCorrection';

              // Create the channel name for this crystal
              var cloverNum = Math.floor(thisGeindex/4)+1;
              var GeName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0];
             urls[num] += "&channelName0="+GeName;

              // Add the k1 coefficients
              urls[num] += "&pileupk10=";
              for(var i=0; i<dataStore.fitResultsParameters[GeName]['k1'].length; i++){
                if(i>0){ urls[num] += ",";  }
                urls[num] += dataStore.fitResultsParameters[GeName]['k1'][i];
              }

              // Add the k2 coefficients
              urls[num] += "&pileupk20=";
              for(var i=0; i<dataStore.fitResultsParameters[GeName]['k2'].length; i++){
                if(i>0){ urls[num] += ",";  }
                urls[num] += dataStore.fitResultsParameters[GeName]['k2'][i];
              }

              // Add the e1 offset coefficients
              urls[num] += "&pileupE10=";
              for(var i=0; i<dataStore.fitResultsParameters[GeName]['e1'].length; i++){
                if(i>0){ urls[num] += ",";  }
                urls[num] += dataStore.fitResultsParameters[GeName]['e1'][i];
              }

              num++; // move to next url, one for each crystal
            } // end of Ge loop

            console.log(urls);

      //send requests
      for(i=0; i<urls.length; i++){
        XHR(urls[i],
          'check ODB - response rejected. This will happen despite successful ODB write if this app is served from anywhere other than the same host and port as MIDAS (ie, as a custom page).',
          function(){return 0},
          function(error){console.log(error)}
        )
      }

      //get rid of the modal
      document.getElementById('dismissAnalyzermodal').click();
    }


        function postProcessPUFirst2Hit(){
          // Post processing for 2-Hit pileup, 2nd Hit correction as function of k.
        //
        // Perform 6th order polynomial fit of correction factor as function of k.
        // Result is function describing correction factor as function of k.
        console.log("\n\n==============================\n  Post-processing for pile-up, k dependance correction...\n\n");

    // Inject the report card templates and setup


    // Get the keys from the fitResults object.
        var keys = Object.keys(dataStore.fitResults);

    // Loop through all Ge crystals
          for(var thisGeindex = 0; thisGeindex<8; thisGeindex++){
        var GeNum = 1;
        var GeString = "Ge" + alwaysThisLong(GeNum, 2);
        var matrixString = "_PU2_E2_vs_k2_E1gated_on_x-raysx";
        var data = [];


        var Cstring = "";

        // Get the single hit centroid energy of 1408keV peak for this crystal
        // GRG01BN00A_Energy
        var crystals = ["B","G","R","W"];
        var letter = ["A","B"];
        var cloverNum = Math.floor(thisGeindex/4)+1;
        var GeSingleSpecName = "GRG" + alwaysThisLong(cloverNum, 2) + crystals[thisGeindex%4] + 'N00' + letter[0] + "_Energy";
        var singleHitEnergy = dataStore.fitResults[dataStore.histoFileName.split(".")[0]+":"+GeSingleSpecName][0][1];
        console.log("SinglesEnergy for "+GeSingleSpecName+" in "+dataStore.histoFileName+" is "+singleHitEnergy);

        for(var thisKvalue=5; thisKvalue<380; thisKvalue+=20){

                // Spectrum names of the form: GeX_E_vs_k_1st_of_2hitx where X is Ge number.
                // Kstring will be the projection values in this case.
        var Kstring = "x-"+(parseInt(thisKvalue)-5)+"-"+(parseInt(thisKvalue)+5);

            for(var j=0; j<keys.length; j++){

              if(keys[j].includes(matrixString) && keys[j].includes(GeString) && keys[j].includes(Kstring)){
                // xValue is k value.
                var xValue = parseInt(thisKvalue);

                // yValue is the necessary correction to the Energy centroid to match the centroid from the single Hit spectrum
                var yValue = parseFloat(1.0-(dataStore.fitResults[keys[j]][0][1]/singleHitEnergy)+1.0);

                data.push([xValue,yValue]);
                Cstring += yValue + "<br>";
              }
            }
    }

    // Add the single hit data point. This seems to be important.
        data.push([379,1.0]);

        console.log(data);
        // Perform 6th order polynomial fit of the series of y=correction factor as a function of x=k.
            // Hats off to Tom Alexander, https://github.com/Tom-Alexander/regression-js
            const result = regression.polynomial(data, { order: 3, precision: 20 });

            console.log(result.equation);
            console.log(result.string);       //  A string representation of the equation

        // Save the Cstring.
        // An array of the parameters for this HPGe
        Cstring += "<br>{"
        for(var i=result.equation.length-1; i>=0; i--){ Cstring += result.equation[i]; if(i>0){ Cstring += ","; } }
        Cstring += "},";

        console.log(Cstring);
      } // End of Ge loop

        document.getElementById("postProcessResults").innerHTML = Cstring + "<br>";
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

if(payload.length<2){
  console.log("Problem getting Config information for file: "+dataStore.histoFileName+". Check filename and data directory.");
  document.getElementById('error-messages-for-drop-area').innerHTML = "Problem getting Config information for file: "+dataStore.histoFileName+". Check filename and data directory.";
}else{
      console.log(payload);
    }
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

    // Function to increment the progressBar by the stated amount
    function updateProgressBar(updateValue){
      dataStore.progressBarTasksCompleted+=parseInt(updateValue);
      dataStore.ProgressValue = (100*(dataStore.progressBarTasksCompleted/dataStore.progressBarNumberTasks)).toFixed(1);
      document.getElementById(dataStore.progressBarKey).setAttribute('style', "width:" + dataStore.ProgressValue + "%" );
      document.getElementById(dataStore.progressBarKey).innerHTML = dataStore.ProgressValue + "% complete";
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

        // Check this matrix has been received from the server
        try{
          var name = dataStore.rawData[thisKey].name;
        }
        catch(err){
          document.getElementById('error-messages-for-drop-area').innerHTML = "Problem fetching matrix "+thisKey+". Check spectrum name.";
          return;
        }

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
            await createNewProjection("x",gateMin,gateMax,BG1SF,BG1Min,BG1Max,BG2SF,BG2Min,BG2Max);
          }else if(matrixKeys[i].gateDetails[0] == "y"){
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

        // resolve the promise
        setTimeout(function(){resolve('Success!')},5);
      });

    };


    function fitPeaksInSeriesOfHistograms(spectra,peaks){
      //fit all spectra to the peaks defined.

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
        var thisPeakWidth = Math.ceil(typicalPeakWidth(peaks[peakIndex],"HPGe")*8);

        //set up peak fit
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
      if(!dataStore.fitResults[dataStore.currentPlot]) dataStore.fitResults[dataStore.currentPlot] = [];
      dataStore.fitResults[dataStore.currentPlot][dataStore.currentPeak] = [amplitude, center, width, intercept, slope, area, fwhm];

      // Update the ROI in case they were modified by the fitting routine
      // DO WE NEED ROI ANY MORE? Yes, for addFitLines
      dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][0] = dataStore.viewers[viewerName].FitLimitLower;
      dataStore.ROI[dataStore.currentPlot][dataStore.currentPeak][1] = dataStore.viewers[viewerName].FitLimitUpper;

      //disengage fit mode buttons
    //  if( parseInt(refitPeak.getAttribute('engaged'),10) == 1){
    //    refitPeak.onclick();
    //  }
    }

    function addFitLines(){
      //add current fits to the plot

      var fitLines = [];
      var viewerName = dataStore.plots[0];

      dataStore.viewers[viewerName].containerFit.removeAllChildren();

      // Bail out of no fitResults yet
      if(!dataStore.fitResults[dataStore.currentPlot]){
      //  console.log('No fitResults yet for '+dataStore.currentPlot+' in addFitLines so bailing out');
        return;
      }

      // Loop through the peaks for this spectrum
      for(i=0; i<dataStore.ROI[dataStore.currentPlot].length; i++){
        //add fit lines
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
