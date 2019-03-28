// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { IORunManager } from './ioRunManager';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//	console.log('Congratulations, your extension "cpcomplete" is now active!');
	let config = vscode.workspace.getConfiguration('io-run');
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello CP, check io-run for further configuration!');
	});

	let ioRunManager = new IORunManager(config);

    vscode.workspace.onDidChangeConfiguration(() => {
        config = vscode.workspace.getConfiguration('io-run');
        ioRunManager.updateConfig(config);
   //     analytics.updateConfig(config);
    });
    let extractsnippet = vscode.commands.registerCommand('io-run.extractsnippet', () => {
        ioRunManager.extractSnippet();
    });
    let mergesnippet = vscode.commands.registerCommand('io-run.mergesnippet', () => {
        ioRunManager.mergeSnippet();
    });
    let showsnippet = vscode.commands.registerCommand('io-run.showsnippet', () => {
        ioRunManager.showSnippet();
    });
    let compileonly = vscode.commands.registerCommand('io-run.compileonly', () => {
        ioRunManager.compileOnly();
    });
    let run = vscode.commands.registerCommand('io-run.run', () => {
        ioRunManager.run();
    });
    let run1input = vscode.commands.registerCommand('io-run.run-1-input', () => {
        ioRunManager.run(false);
    });

    let stop = vscode.commands.registerCommand('io-run.stop', () => {
        ioRunManager.stop();
    });

    let addInputOutput = vscode.commands.registerCommand('io-run.add-input-output', () => {
        ioRunManager.addInputOutput();
    });
    context.subscriptions.push(extractsnippet);
    context.subscriptions.push(mergesnippet);
    context.subscriptions.push(showsnippet);
    context.subscriptions.push(compileonly);
    context.subscriptions.push(run);
    context.subscriptions.push(run1input);
    context.subscriptions.push(stop);
    context.subscriptions.push(addInputOutput);
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
