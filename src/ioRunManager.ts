'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as et from './errorTracer';
import * as tools from './tools';
//import * as analytics from './analytics';
import * as express from 'express';
import * as bodyParser from 'body-parser';

export class IORunManager {
    private output: vscode.OutputChannel;
    private terminal: vscode.Terminal;
    private process;
    private codeFile: string;
    private config: vscode.WorkspaceConfiguration;
    private killRequested: boolean;
    private timeLimitExceeded: boolean;
    private executeTimer;

    private port;
    private app;
    private data;
    private curname;  // We use this to create and set up new file name sequence like A,B,C,D 
    

    private runningCodeFile: string;

    constructor(config) {
        this.output = vscode.window.createOutputChannel('IO Run');
        this.terminal = vscode.window.createTerminal('IO Run');
        this.killRequested = false;
        this.timeLimitExceeded = false;
        this.config = config;
        // Enable server
        this.app = express();
        //this.port = 8080;
        this.port = this.config.pluginListenPort;
        //const bodyparser = bodyParser();
        this.app.use(bodyParser.json());
        this.app.post('/', (req, res) => {
            this.data = req.body;
          
            // console.log(`Problem name: ${this.data.name}`);
            // console.log(`Problem group: ${this.data.group}`);
            // console.log('Full body:');
            // console.log(JSON.stringify(this.data, null, 4));
          
            res.sendStatus(200);

            // Now process the data and write it into a file and open it
            let codeFile = this.getCodeFile();
            if (codeFile === null) return;
            let inputExt = this.config.inputExtension.toLowerCase();
            let acceptExt = this.config.acceptExtension.toLowerCase();
            let codeFileNoExt = tools.getFileNoExtension(codeFile);     
            
            // Check current data
            let infoFileName = codeFileNoExt + '.' + 'json';
            fs.writeFileSync(infoFileName, JSON.stringify(this.data, null, 4));

            let pad = x => { return (x < 10) ? ('0' + x) : x };  
            
            let testsnum = this.data.tests.length;
            for (var j=0; j< testsnum; j++) {

                for (var i = 1; i <= 999; i++) {
                    let inputFileName = codeFileNoExt + '.' + pad(i) + inputExt;
                    if (!fs.existsSync(inputFileName)) {
                        let acceptFileName = codeFileNoExt + '.' + pad(i) + acceptExt;
                        if (!fs.existsSync(acceptFileName)) {
                            // The place to write one file
                            fs.writeFileSync(acceptFileName, this.data.tests[j].output);
                        }   
                            fs.writeFileSync(inputFileName, this.data.tests[j].input);    
                            // save all json file  

                        break;
                    }
                }
             }
          });
          
         this.app.listen(this.port, err => {
            if (err) {
              console.error(err);
              process.exit(1);
            }
          
            console.log(`Listening on port ${this.port}`);
          });
          
    }

    public updateConfig(config): void {
        this.config = config;
    }

    public stop(): void {
      //  analytics.send("Action", "stop");

        if (this.process != null) {
            this.killRequested = true;
            let kill = require('tree-kill');
            kill(this.process.pid);
        }
    }

    public addInputOutput(): void {
       // analytics.send("Action", "addInputOutput");

        let codeFile = this.getCodeFile();
        if (codeFile === null) {return;}

        let codeFileNoExt = tools.getFileNoExtension(codeFile);
        let inputExt = this.config.inputExtension.toLowerCase();
        let acceptExt = this.config.acceptExtension.toLowerCase();

        let pad = x => { return (x < 10) ? ('0' + x) : x; };

        for (var i = 1; i <= 999; i++) {
            let inputFileName = codeFileNoExt + '.' + pad(i) + inputExt;
            if (!fs.existsSync(inputFileName)) {
                let acceptFileName = codeFileNoExt + '.' + pad(i) + acceptExt;
                if (!fs.existsSync(acceptFileName)) {
                    // The place to write one file
                    fs.writeFileSync(acceptFileName, '');
                }
                vscode.workspace.openTextDocument(acceptFileName).then(doc => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);

                    fs.writeFileSync(inputFileName, '');
                    vscode.workspace.openTextDocument(inputFileName).then(doc => {
                        vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                    });
                });

                return;
            }
        }
    }

    public extractSnippet(): void {
        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        let codeFile = this.getCodeFile();
        if (codeFile == null) return;

        let executor = this.getExecutor(codeFile);
        if (executor.clearPreviousOutput) {
            this.output.clear();
        }
        this.output.show(true);
        this.output.append('[' + executor.codeFile + ' on ' + os.platform() + '] extracting snippets ... \n');
        //var outstring = this.extractSnippetFromFile(codeFile);
        let sp_path_sys = executor.homedir + path.sep + executor.filesystemsnippet;
        let sp_dir_snippet = executor.homedir + path.sep + executor.dirsnippet;
        if (!fs.existsSync(sp_dir_snippet)){
            fs.mkdirSync(sp_dir_snippet);
        }

        let sp_sys_filename =  sp_path_sys.substring(sp_path_sys.lastIndexOf(path.sep)+1);

        let sp_path_local = sp_dir_snippet.substring(0, sp_dir_snippet.lastIndexOf(path.sep)+1) + sp_sys_filename ;

        if (!fs.existsSync(sp_path_sys)){
            if (!fs.existsSync(sp_path_sys.substring(0,sp_path_sys.lastIndexOf(path.sep)+1))){
                 fs.mkdirSync(sp_path_sys.substring(0,sp_path_sys.lastIndexOf(path.sep)+1));
            }
            //copy sample file over.
            fs.copyFileSync(sp_path_local, sp_path_sys);
          }

        let sStart =executor.snippetStart; //executor.
        let sEnd = executor.snippetEnd;
        let readLineSync = require('./readLineSync');
        let iLiner = readLineSync(codeFile);
        let bRecordSnippet = false;
        let sFileToWrite = '';  
        let sPrefix = '';  
        let sDesc = '';  //copy what ever and appending the origin of file

        
        let testsnippet = {};
        let body = [];


        while (true) {
            let iline = iLiner.next();
            if (iline.done){
                return;
            }

            if (iline.value.startsWith(sStart)){
                bRecordSnippet = true;
                sPrefix = iline.value.substring(sStart.length+1).trim();
                sFileToWrite = sp_dir_snippet + path.sep + sPrefix + ".json";  //need combine with src dir in dir, 
                testsnippet['prefix'] = sPrefix;
            
                continue;
            }

            if (iline.value.startsWith(sEnd)){
                bRecordSnippet = false;
                sDesc = iline.value.substring(sEnd.length+1).trim();  //right after prefix
                sDesc =sDesc + '|' + codeFile.substring(executor.homedir.length+1).replace(/\\/g, "/"); 
                testsnippet['description'] = sDesc;
                testsnippet['body']=body;

                var jdata = {};
                jdata[sPrefix] = testsnippet;
                let data = JSON.stringify(jdata, undefined, 2);  
                fs.writeFileSync(sFileToWrite, data);

                vscode.workspace.openTextDocument(sFileToWrite).then(doc => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
                });
                body = []; //must clear the body for next block
                testsnippet = {};
                continue;
            }

            if (bRecordSnippet){
                body.push(tools.quoteLine(iline.value));
            }
        }

        // open the create json file in new windows
  
        // create a file and open it like output. 
    }

    public mergeSnippet(): void {
        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        let codeFile = this.getCodeFile();
        if (codeFile == null) return;

        let executor = this.getExecutor(codeFile);
        if (executor.clearPreviousOutput) {
            this.output.clear();
        }
        this.output.show(true);
        
        // need form the right path 
        let sp_path_sys = executor.homedir + path.sep + executor.filesystemsnippet;
        let sp_dir_snippet = executor.homedir + path.sep + executor.dirsnippet;
        
        let sp_sys_filename =  sp_path_sys.substring(sp_path_sys.lastIndexOf(path.sep)+1);
       // let lang_cat = sp_sys_filename.split('.')[0];

        let sp_path_local = sp_dir_snippet.substring(0, sp_dir_snippet.lastIndexOf(path.sep)+1) + sp_sys_filename ;

        let rawdata = fs.readFileSync(sp_path_sys);  
        let systemsp = JSON.parse(rawdata.toString());

        let lf = fs.readdirSync(sp_dir_snippet);

            // ["c://some-existent-path/file.txt","c:/some-existent-path/subfolder"]
        lf.forEach(file => {
            file = path.resolve(sp_dir_snippet, file);
            let rd = fs.readFileSync(file);
            let curJSON = JSON.parse(rd.toString());
            let targetJSON = {};
            for (var prop in curJSON)
            {
                targetJSON = curJSON[prop];
                systemsp[targetJSON['prefix']]=targetJSON;
            }
            // let curPrefix= targetJSON['prefix'];
            
        });

        let jdata = JSON.stringify(systemsp, undefined, 2);  
        fs.writeFileSync(sp_path_sys, jdata);
        fs.writeFileSync(sp_path_local, jdata);

    }

    //allow us to show the basic system configuration.
    public showSnippetSys(): void {
        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        let codeFile = this.getCodeFile();
        if (codeFile == null) return;

        let executor = this.getExecutor(codeFile);
        if (executor.clearPreviousOutput) {
            this.output.clear();
        }
        this.output.show(true);
        this.output.append('[' + executor.codeFile + ' on ' + os.platform() + '] showing snippets ... \n');

        let sp_path_sys = executor.homedir + path.sep + executor.filesystemsnippet;
        let sp_dir_snippet = executor.homedir + path.sep + executor.dirsnippet;
        
        let sp_sys_filename =  sp_path_sys.substring(sp_path_sys.lastIndexOf(path.sep)+1);

        let sp_path_local = sp_dir_snippet.substring(0, sp_dir_snippet.lastIndexOf(path.sep)+1) + sp_sys_filename ;

        if (!fs.existsSync(sp_path_sys)){
            if (!fs.existsSync(sp_path_sys.substring(0,sp_path_sys.lastIndexOf(path.sep)+1))){
                 fs.mkdirSync(sp_path_sys.substring(0,sp_path_sys.lastIndexOf(path.sep)+1));
            }
            //copy sample file over.
            fs.copyFileSync(sp_path_local, sp_path_sys);
          }
    
        vscode.workspace.openTextDocument(sp_path_sys).then(doc => {
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
        });
    }
    // show the current keyword in the first comment. 
    // Will generate all the link in a .md file
    // So we can click and go
    public showSnippet(): void {
        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        let codeFile = this.getCodeFile();
        if (codeFile == null) return;

        let executor = this.getExecutor(codeFile);
        if (executor.clearPreviousOutput) {
            this.output.clear();
        }
        this.output.show(true);
        //read the first line contain the keyword
        //for each one with the valid match, extract the link if it has one and dump 
        // to the choosen md file on the home directory 
        // and open it.
        // skip the first two letter as comments, then name of the link file, then search key word 
        // seperated by space. Should be and operation.
        let readLineSync = require('./readLineSync');
        let iLiner = readLineSync(codeFile);
        let firstline = iLiner.next().value;
        let wl = firstline.substring(2).trim().split(); //always start from second comment

        let sp_path_sys = executor.homedir + path.sep + executor.filesystemsnippet;       
        let link_file = executor.homedir + path.sep + 'links.md';

        let rawdata = fs.readFileSync(sp_path_sys);  
        let systemsp = JSON.parse(rawdata.toString());

        let links=[];

        for (var prop in systemsp)
        {
            let curJ = systemsp[prop];
            let descNlink = curJ['description'];
            let alist= descNlink.split('|');
            let strToSearch = alist[0];
            for(var wordindex in wl){
              let index =  strToSearch.toLowerCase().indexOf(wl[wordindex].toLowerCase());
              if (index >= 0){
                  if (alist.length>1){
                    links.push('['+ curJ['prefix'] + '](' + alist[1]+')');

                    continue;
                  }
              }
            }
        }

        if (links.length > 0){
            var jdata = {};
            jdata['search'] = firstline.substring(2);
            jdata['links'] = links;
            
            let data = JSON.stringify(jdata, undefined, 2);  
            fs.writeFileSync(link_file, data);
            vscode.workspace.openTextDocument(link_file).then(doc => {
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            });
        }
        else{
            this.output.append('nothing found for your search string');
        }
    }

    public compileOnly(): void {
        //  analytics.send("Action", "run");
  
          if (this.process != null) {
              vscode.window.showInformationMessage('[' + this.runningCodeFile + '] still running!');
              return;
          }
  
          let activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor) return;
  
          let codeFile = this.getCodeFile();
          if (codeFile == null) return;
  
          let executor = this.getExecutor(codeFile);
          executor.runAllInput = true;
  
        //  analytics.send("CodeExt", executor.codeExt);
  
          if (executor.clearPreviousOutput) {
              this.output.clear();
          }
          this.output.show(true);
  
          let listFileNeedSaved = this.getListFileNeedSaved(executor);
          if (listFileNeedSaved.length > 0) {
              this.saveFilesAndCompileOnly(executor, listFileNeedSaved);
          } else {
              this.compileCodeOnly(executor);
          }
      }

    public run(runAllInputs: boolean = true): void {
      //  analytics.send("Action", "run");

        if (this.process != null) {
            vscode.window.showInformationMessage('[' + this.runningCodeFile + '] still running!');
            return;
        }

        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        let codeFile = this.getCodeFile();
        if (codeFile == null) return;

        let executor = this.getExecutor(codeFile);
        executor.runAllInput = runAllInputs;

      //  analytics.send("CodeExt", executor.codeExt);

        if (executor.clearPreviousOutput) {
            this.output.clear();
        }
        this.output.show(true);

        let listFileNeedSaved = this.getListFileNeedSaved(executor);
        if (listFileNeedSaved.length > 0) {
            this.saveFilesAndCompile(executor, listFileNeedSaved);
        } else {
            this.compileCode(executor);
        }
    }

    private setCmdVar(executor: any, cmd: string): string {
        cmd = tools.replaceVar(cmd, "dir", executor.codeDir);
        cmd = tools.replaceVar(cmd, "dirCodeFile", executor.codeDirFile);
        cmd = tools.replaceVar(cmd, "dirCodeFileNoExt", executor.codeDirFileNoExt);
        cmd = tools.replaceVar(cmd, "codeFile", executor.codeFile);
        cmd = tools.replaceVar(cmd, "codeFileNoExt", executor.codeFileNoExt);
        return cmd;
    }

    private jumpToErrorPosition(executor: any, errMsg: string) {
        let codeFileEscaped = executor.codeFile.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        let errLocationRegExps = [
            codeFileEscaped + ":(\\d+)(:(\\d+))?",
            'File "' + codeFileEscaped + '", line (\\d+)',
            codeFileEscaped + "\\((\\d+),(\\d+)\\)",
        ];

        for (let iReg in errLocationRegExps) {
            let errLocationRegExp = errLocationRegExps[iReg];
            let r = new RegExp(errLocationRegExp);
            let arr = r.exec(errMsg);
            if (arr != null && arr.length > 1) {
                let line = Number(arr[1]);
                let character = 1;
                if (arr.length > 3) {
                    character = Number(arr[3]);
                }

                vscode.workspace.openTextDocument(executor.codeDirFile).then(doc => {
                    vscode.window.showTextDocument(doc).then(editor => {
                        if (character < 1) character = 1;
                        if (line < 1) line = 1;

                        let position = new vscode.Position(line - 1, character - 1)
                        var newSelection = new vscode.Selection(position, position);
                        editor.selection = newSelection;
                        let startRange = new vscode.Position(position.line < 5 ? 0 : position.line - 5, position.character);
                        let endRange = position;
                        editor.revealRange(new vscode.Range(startRange, endRange));
                    });
                });

                break;
            }
        }
    }

    // create a function for compile the code only, like when we want to debug
    private compileCodeOnly(executor: any){
        let compileCmd = this.setCmdVar(executor, executor.compileCmd);
        let processEnv = Object.assign({}, process.env);
        if (executor.PATH) {
            processEnv.PATH = executor.PATH + path.delimiter + processEnv.PATH;
        }
        processEnv.PATH = executor.codeDir + path.delimiter + processEnv.PATH;

        this.output.append('[' + executor.codeFile + '] compiling... ');
        this.process = require('child_process').exec(compileCmd, { cwd: executor.codeDir, env: processEnv });

        let stdout = '';
        let stderr = '';
        this.process.stdout.on('data', (data) => {
            stdout += data;
        });
        this.process.stderr.on('data', (data) => {
            stderr += data;
        });
        this.process.on('close', (code) => {
            this.process = null;
            if (code === 0) {
                this.output.appendLine('ok');
               //  this.runCode(executor);   // the only difference
            } else {
                this.output.appendLine('error!');
                if (stdout.length > 0) this.output.appendLine(stdout);
                if (stderr.length > 0) this.output.appendLine(stderr);

                this.jumpToErrorPosition(executor, stdout + stderr);
            }
        });       
    }

    private compileCode(executor: any) {

        if (executor.compileCmd === null || executor.compileCmd.length === 0) {
            this.output.appendLine('[' + executor.codeFile + '] will be run');
            this.runCode(executor);
            return;
        }

        let compileCmd = this.setCmdVar(executor, executor.compileCmd);
        let processEnv = Object.assign({}, process.env);
        if (executor.PATH) {
            processEnv.PATH = executor.PATH + path.delimiter + processEnv.PATH;
        }
        processEnv.PATH = executor.codeDir + path.delimiter + processEnv.PATH;

        this.output.append('[' + executor.codeFile + '] compiling... ');
        this.process = require('child_process').exec(compileCmd, { cwd: executor.codeDir, env: processEnv });

        let stdout = '';
        let stderr = '';
        this.process.stdout.on('data', (data) => {
            stdout += data;
        });
        this.process.stderr.on('data', (data) => {
            stderr += data;
        });
        this.process.on('close', (code) => {
            this.process = null;
            if (code === 0) {
                this.output.appendLine('ok');
                this.runCode(executor);
            } else {
                this.output.appendLine('error!');
                if (stdout.length > 0) this.output.appendLine(stdout);
                if (stderr.length > 0) this.output.appendLine(stderr);

                this.jumpToErrorPosition(executor, stdout + stderr);
            }
        });
    }

    private runCode(executor: any) {
        let inputFiles = this.getInputFiles(executor);
        if (inputFiles.length === 0) {
            if (executor.runAllInput) {
                this.runInTerminal(executor);
            }
            return;
        }

        this.runningCodeFile = executor.codeFile;

        let baseRunCmd = this.setCmdVar(executor, executor.runCmd);

        let runTopInput = () => {

            let inputFile = inputFiles[0];
            let outputFile = tools.getFileNoExtension(inputFile) + executor.outputExtension;
            let acceptFile = tools.getFileNoExtension(inputFile) + executor.acceptExtension;
            let runCmd = baseRunCmd;
            runCmd = tools.replaceVar(runCmd, "inputFile", inputFile);
            runCmd = tools.replaceVar(runCmd, "outputFile", outputFile);

            this.output.append('[' + path.basename(inputFile + '] as input, running... '));
            let processEnv = Object.assign({}, process.env);
            if (executor.PATH) {
                processEnv.PATH = executor.PATH + path.delimiter + processEnv.PATH;
            }

            processEnv.PATH = executor.codeDir + path.delimiter + processEnv.PATH;
            let startTime = new Date();
            if (this.executeTimer != null) {
                clearTimeout(this.executeTimer);
                this.executeTimer = null;
            }

            if (executor.timeLimit > 0) {
                this.executeTimer = setTimeout(() => {
                    if (this.process != null) {
                        this.timeLimitExceeded = true;
                        let kill = require('tree-kill');
                        kill(this.process.pid);
                    }
                }, executor.timeLimit * 1000);
            }

            this.process = require('child_process').exec(runCmd, { cwd: executor.codeDir, env: processEnv }, (err, stdout, stderr) => {
                let isOK = false;
                if (this.killRequested) {
                    this.output.appendLine('STOPPED');
                    this.killRequested = false;
                    this.cleanup(executor);
                    return;
                } else if (this.timeLimitExceeded) {
                    this.output.appendLine('TLE');
                    this.timeLimitExceeded = false;
                } else {
                    let endTime = new Date();
                    let elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;

                    this.process = null;
                    if (err === null) {
                        this.output.append('done ' + elapsedTime.toFixed(3) + 's');

                        let oFile = path.join(executor.codeDir, outputFile);
                        let aFile = path.join(executor.codeDir, acceptFile);
                        if (fs.existsSync(oFile)) {
                            if (fs.statSync(oFile).size === 0) {
                                this.output.appendLine(' ' + executor.outputExtension + ' empty');
                                if (executor.deleteOutputFiles) {
                                    fs.unlinkSync(oFile);
                                }
                            } else if (fs.existsSync(aFile) && fs.statSync(aFile).size > 0) {
                                if (this.compareOA(executor, oFile, aFile)) {
                                    this.output.appendLine(' AC');
                                    isOK = true;
                                    if (executor.deleteOutputFiles) {
                                        fs.unlinkSync(oFile);
                                    }
                                } else {
                                    this.output.appendLine(' WA');

                                    let showDiff = () => {
                                        if (executor.showDiffInOutputPanel) {
                                            this.output.appendLine('Your output:');
                                            let output = fs.readFileSync(oFile).toString();
                                            this.output.appendLine(output.trim());
                                            this.output.appendLine('Correct answer:');
                                            let answer = fs.readFileSync(aFile).toString();
                                            this.output.appendLine(answer.trim());
                                            return;
                                        }
                                        vscode.workspace.openTextDocument(oFile).then(doc => {
                                            vscode.window.showTextDocument(doc, vscode.ViewColumn.Two).then(editor => {
                                                let diffTitle = outputFile + '⟷' + acceptFile;
                                                vscode.commands.executeCommand('vscode.diff',
                                                    vscode.Uri.file(oFile),
                                                    vscode.Uri.file(aFile),
                                                    diffTitle
                                                );
                                            });
                                            if (executor.showInputFileOnWrongAnswer) {
                                                let iFile = path.join(executor.codeDir, inputFile);
                                                vscode.workspace.openTextDocument(iFile).then(doc => {
                                                    vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                                                });
                                            }
                                            this.cleanup(executor);
                                        });

                                    };

                                    if (vscode.window.activeTextEditor.document.fileName == oFile) {
                                        vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(() => {
                                            showDiff();
                                        });
                                    } else {
                                        showDiff();
                                    }

                                    if (!executor.continueOnFails || !executor.showDiffInOutputPanel) {
                                        this.cleanup(executor);
                                        return;
                                    }
                                }
                            } else {
                                this.output.appendLine(' empty');
                                this.output.appendLine('Your output:');
                                let output = fs.readFileSync(oFile).toString();
                                if (output.length > 100) { output = output.substr(0, 100) + '...'; }
                                this.output.appendLine(output.trim());
                            }
                        }
                    }
                    else {
                        this.output.appendLine('RTE');
                        // if (!this.traceError(executor, runCmd, processEnv)) {
                        //     this.output.appendLine(stderr);
                        //     this.jumpToErrorPosition(executor, stderr);
                        //     this.cleanup(executor);
                        // }
                        this.cleanup(executor);
                        return;
                    }
                }
                
                // show stderr when fails
                if (!isOK && executor.showErrorOutputOnFails && stderr.length > 0) {
                    this.output.appendLine('stderr:');
                    this.output.appendLine(stderr.trim());
                }

                inputFiles.shift();
                if (inputFiles.length === 0) {
                    this.cleanup(executor);
                    return;
                }
                runTopInput();
            });
        };

        runTopInput();
    }

    private traceError(executor: any, runCmd: string, processEnv: NodeJS.ProcessEnv): boolean {
        return et.TraceError(executor.errorTracer, runCmd, executor.codeDir, processEnv, (output) => {
            this.output.appendLine(output);
            this.jumpToErrorPosition(executor, output);
            this.cleanup(executor);
        });
    }
    



    private compareOA(executor: any, oFile: string, aFile: string): boolean {
        let readLineSync = require('./readLineSync');

        let oLiner = readLineSync(oFile);
        let aLiner = readLineSync(aFile);


        while (true) {
            let oline = oLiner.next();
            let aline = aLiner.next(); 
            if (oline.done || aline.done) {
                return oline.done === aline.done;
            }
            if (executor.diffIgnoreSpaces) {
                oline.value = (oline.value || '').trim();
                aline.value = (aline.value || '').trim();
            }
            if (oline.value != aline.value) {
                return false;
            }
        }
    }

    private cleanup(executor: any) {
        if (executor.cleanupAfterRun && executor.cleanupCmd) {
            let cleanupCmd = this.setCmdVar(executor, executor.cleanupCmd);
            this.output.append('cleanup... ');
            let processEnv = Object.assign({}, process.env);
            if (executor.PATH) {
                processEnv.PATH = executor.PATH + path.delimiter + processEnv.PATH;
            }
            processEnv.PATH = executor.codeDir + path.delimiter + processEnv.PATH;

            this.process = require('child_process').exec(cleanupCmd, { cwd: executor.codeDir, env: processEnv });
            this.process.on('close', (code) => {
                this.process = null;
                this.output.appendLine('done');
            });
        }
    }

    private getListFileNeedSaved(executor: any): vscode.TextDocument[] {
        if (executor.saveFileBeforeRun) {
            let saveList: vscode.TextDocument[] = [];

            let activeFileNoExt = tools.getFileNoExtension(vscode.window.activeTextEditor.document.fileName);

            vscode.workspace.textDocuments.forEach(doc => {
                if (!doc.isDirty){ return;}

                if (doc.fileName === executor.codeDirFile) {
                    saveList.push(doc);
                } else if (doc.fileName.startsWith(executor.codeDirFileNoExt + ".")) {
                    if (executor.runAllInput || doc.fileName.startsWith(activeFileNoExt + ".")) {
                        let ext = path.extname(doc.fileName).toLowerCase();
                        if (ext === executor.inputExtension || ext === executor.acceptExtension || ext === executor.outputExtension) {
                            let mid = doc.fileName.substr(activeFileNoExt.length + 1, doc.fileName.length - activeFileNoExt.length - ext.length - 1);
                            if (mid.indexOf(".") < 0) {
                                saveList.push(doc);
                            }
                        }
                    }
                }
            });

            return saveList;
        }
    }
    private saveFilesAndCompileOnly(executor: any, saveList: vscode.TextDocument[]) {
        let saveTopDoc = () => {
            let doc = saveList[0];
            this.output.append('[' + path.basename(doc.fileName) + '] saving... ');
            doc.save().then(() => {
                this.output.appendLine('ok');
                saveList.shift();
                if (saveList.length === 0) {
                    this.compileCodeOnly(executor);
                } else {
                    saveTopDoc();
                }
            });
        };
        if (saveList.length > 0) {
            saveTopDoc();
        }

    }

    private saveFilesAndCompile(executor: any, saveList: vscode.TextDocument[]) {
        let saveTopDoc = () => {
            let doc = saveList[0];
            this.output.append('[' + path.basename(doc.fileName) + '] saving... ');
            doc.save().then(() => {
                this.output.appendLine('ok');
                saveList.shift();
                if (saveList.length === 0) {
                    this.compileCode(executor);
                } else {
                    saveTopDoc();
                }
            });
        };
        if (saveList.length > 0) {
            saveTopDoc();
        }

    }

    private getInputFiles(executor: any): Array<string> {
        let inputFiles = Array<string>();

        let dirFiles = fs.readdirSync(executor.codeDir);
        let activeFileNoExt = tools.getFileNoExtension(path.basename(vscode.window.activeTextEditor.document.fileName));

        let lenName = executor.codeFileNoExt.length;
        let lenExt = executor.inputExtension.length;

        dirFiles.forEach(f => {
            if (executor.runAllInput || f.startsWith(activeFileNoExt + ".")) {
                if (f.startsWith(executor.codeFileNoExt) && f.toLowerCase().endsWith(executor.inputExtension)) {
                    let mid = f.substr(activeFileNoExt.length + 1, f.length - activeFileNoExt.length - lenExt - 1);
                    if (mid.indexOf(".") < 0) {
                        inputFiles.push(f);
                    }
                }
            }
        });

        inputFiles.sort((a, b) => {
            let midA = a.substr(lenName, a.length - lenName - lenExt);
            let midB = b.substr(lenName, b.length - lenName - lenExt);
            return midA < midB ? -1 : a === b ? 0 : 1;
        });

        return inputFiles;
    }

    private clearTerminal() {
        this.terminal.hide();
        if (this.terminal != null) {
            try {
                this.terminal.dispose();
            } catch (error) {

            }
        }

        this.terminal = vscode.window.createTerminal('IO Run');
        if (os.platform() === 'win32') {
            this.terminal.sendText("cls");
        } else {
            this.terminal.sendText("clear");
        }
    }


    private runInTerminal(executor: any): void {
        if (executor.clearPreviousOutput) {
            this.clearTerminal();
        }

        this.terminal.sendText('cd ' + tools.quoteFileName(executor.codeDir));
        this.terminal.show();

        let runCmd = this.setCmdVar(executor, executor.runCmd);
        runCmd = runCmd.replace('<${inputFile}', '');
        runCmd = runCmd.replace('>${outputFile}', '');

        let cmd = runCmd.trim();
        if (executor.cleanupAfterRun && executor.cleanupCmd) {
            let cleanupCmd = this.setCmdVar(executor, executor.cleanupCmd);

            let delimiter = ' && ';
            if (os.platform() === 'win32') {
                delimiter = ' & ';
                if (vscode.workspace.getConfiguration("terminal.integrated.shell").get("windows", "").toLocaleLowerCase().endsWith("powershell.exe")) {
                    delimiter = ' "&" ';
                    cmd = "cmd /c " + cmd;
                }
            }

            cmd += delimiter + cleanupCmd.trim();
        }

        this.terminal.sendText(cmd);
    }

    private rndName(): string {
        return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
    }

    private getExecutor(codeFile: string): any {
        let executorMap = this.getExecutorMap();
        let ext = path.extname(codeFile);
        let executor = executorMap[ext];
        if (executor) {
            executor.homedir = this.config.get('homedir');
            executor.codeDir = path.dirname(codeFile);
            executor.codeExt = ext;
            executor.codeFile = path.basename(codeFile);
            executor.codeFileNoExt = path.basename(tools.getFileNoExtension(executor.codeFile));
            executor.codeDirFile = codeFile;
            executor.codeDirFileNoExt = tools.getFileNoExtension(codeFile);
            executor.inputExtension = this.config.inputExtension.toLowerCase();
            executor.outputExtension = this.config.outputExtension.toLowerCase();
            executor.acceptExtension = this.config.acceptExtension.toLowerCase();
            executor.saveFileBeforeRun = this.config.get('saveFileBeforeRun');
            executor.clearPreviousOutput = this.config.get('clearPreviousOutput');
            executor.cleanupAfterRun = this.config.get('cleanupAfterRun');
            executor.deleteOutputFiles = this.config.get('deleteOutputFiles');
            executor.timeLimit = this.config.get('timeLimit');
            executor.showInputFileOnWrongAnswer = this.config.get('showInputFileOnWrongAnswer');
            executor.showDiffInOutputPanel = this.config.get('showDiffInOutputPanel');
            executor.continueOnFails = this.config.get('continueOnFails');
            executor.diffIgnoreSpaces = this.config.get('diffIgnoreSpaces');
            executor.showErrorOutputOnFails = this.config.get<boolean>('showErrorOutputOnFails');
        }

        return executor;
    }

    private getExecutorMap(): any {
        let commonMap = this.config.get('executorMap.common');
        let osMap = this.config.get('executorMap.' + os.platform());

        let commonMapObject = tools.unwrap(commonMap);
        let osMapObject = tools.unwrap(osMap);

        if (osMapObject != null) {
            Object.keys(osMapObject).forEach(function (key) {
                if (!commonMapObject[key]) {
                    commonMapObject[key] = osMapObject[key];
                } else {
                    Object.keys(osMapObject[key]).forEach(function (subkey) {
                        commonMapObject[key][subkey] = osMapObject[key][subkey];
                    });
                }
            });
        }

        return commonMapObject;
    }

    private getCodeFile(): string {
        let executorMap = this.getExecutorMap();
        let activeFile = vscode.window.activeTextEditor.document.fileName;
        let extension = path.extname(activeFile).toLowerCase();
        let executor = executorMap[extension];

        if (executor != null) {
            return activeFile;
        }

        let inputExtension = this.config.inputExtension.toLowerCase();
        let outputExtension = this.config.outputExtension.toLowerCase();
        let acceptExtension = this.config.acceptExtension.toLowerCase();

        if (extension != inputExtension && extension != outputExtension && extension != acceptExtension) {
            return null;
        }

        let activeFileNoExt = tools.getFileNoExtension(activeFile);
        let activeFileNoExt2 = tools.getFileNoExtension(activeFileNoExt);

        for (var doc of vscode.workspace.textDocuments) {
            if (doc.fileName.startsWith(activeFileNoExt + '.') || doc.fileName.startsWith(activeFileNoExt2 + '.')) {
                let ext = path.extname(doc.fileName).toLowerCase();
                if (executorMap[ext]) {
                    return doc.fileName;
                }
            }
        }

        if (activeFileNoExt === '') {return null;}
        for (var ext in executorMap) {
            let fileName = activeFileNoExt + ext;
            if (fs.existsSync(fileName)) {
                return fileName;
            }
            fileName = activeFileNoExt + ext.toUpperCase();
            if (fs.existsSync(fileName)) {
                return fileName;
            }
        }


        if (activeFileNoExt2 == '') return null;
        for (var ext in executorMap) {
            let fileName = activeFileNoExt2 + ext;
            if (fs.existsSync(fileName)) {
                return fileName;
            }
            fileName = activeFileNoExt2 + ext.toUpperCase();
            if (fs.existsSync(fileName)) {
                return fileName;
            }
        }
        return null;
    }

    private getWorkspaceRoot(codeFileDir: string): string {
        return vscode.workspace.rootPath ? vscode.workspace.rootPath : codeFileDir;
    }
}
