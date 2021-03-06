"use strict"
//Required
const vscode                = require('vscode');
const moment                = require('moment');
const f_ColoredTitleBars    = require('./functionsColoredTitleBars');
const f_Config              = require('./functionsConfig');
const f_Headers             = require('./functionsHeaders');
const f_SFTP                = require('./functionsSFTP');
const t_Headers             = require('./templatesHeaders');


//Functions
const checkIn = () => f_SFTP.sftpSyncGet().then(()=> {
    handlerHeader(1).then(()=>{
    f_Config.saveFile();
    });
});
    

const checkOut = () => handlerHeader(2).then(()=>{
    f_Config.saveFile();
});

const handlerColoredTitleBars = () => {
    console.log('Path: handlerColoredTitleBars');
    
    if (f_Config.getUserConfig('enableTitleBarColors')){
        var header  = f_Headers.getCurrentHeader();
        if (f_Headers.headerExists(header)){
            var history = f_Headers.getHeaderHistory(header);
            var email   = f_Config.getUserEmail();

            if (history.status == 2 && history.outBy == email)
                f_ColoredTitleBars.setColors(2);
            else if (history.status == 1)
                f_ColoredTitleBars.setColors(1);
            else
                f_ColoredTitleBars.setColors(0);
        }
        else
            f_ColoredTitleBars.clearColors();
    }
    else
            f_ColoredTitleBars.clearColors();
};

const handlerHeader = (select) => {
    console.log(`Path: handlerHeader [select(${select})]`);

    return new Promise((res, rej) => {
    
        const activeTextEditor = vscode.window.activeTextEditor;
        const document = activeTextEditor.document;
        const languageId = document.languageId;


        if (f_Headers.supportHeaderLanguage(languageId)){
            if (select == 1)
                handlerCheckIn().then((done) =>{
                    if (done)
                        res(1);
                });
            else if (select == 2)
                handlerCheckOut().then((done) =>{
                    if (done)
                        res(1);
                });
        }
        else{
            rej(`CheckoutHeader: Language <${languageId}> Not Supported!`);
            vscode.window.showErrorMessage(`CheckoutHeader: Language <${languageId}> Not Supported!`);
        }
    });
};

const handlerCheckIn = () => {
    console.log('Path: handlerCheckIn');

    return new Promise((res)=>{
        
        const activeTextEditor = vscode.window.activeTextEditor;
        const document = activeTextEditor.document;
        const languageId = document.languageId;
        var     header              = f_Headers.getCurrentHeader();
    
        if (f_Headers.headerExists(header)){
            var history = f_Headers.getHeaderHistory(header);
            var email   = f_Config.getUserEmail();
            
            if (history.status != 1)
                if (history.outBy == email){
                    f_Headers.checkInHeader(history);
                    res(1);
                }
                else {
                    vscode.window.showWarningMessage(
                        `This file is checked-out!\nBy: "${history.outBy}"\n Time: <${history.timeOut}>.`, 'OK');
                }
            else {
                vscode.window.showWarningMessage(`
                This file is already checked-in!\nBy: "${history.inBy}"\nOn: <${history.timeIn}>.`, 'OK');
            }
        }
        else {
            activeTextEditor.edit((editor) => {
                editor.insert(new vscode.Position(0, 0), f_Headers.commentHeader(
                    f_Headers.populateCheckInHeader(t_Headers.in).substring(1), languageId)+'\n');
            });
            res(1);
        }
    });

};

const handlerCheckOut = () => {
    console.log('Path: handlerCheckOut');

    return new Promise((res)=>{

        const activeTextEditor  = vscode.window.activeTextEditor;
        const document          = activeTextEditor.document;
        const languageId        = document.languageId;
        var   header            = f_Headers.getCurrentHeader();
    
        if (f_Headers.headerExists(header)){
            var history = f_Headers.getHeaderHistory(header);
            
            if (history.status != 2){
                f_Headers.checkOutHeader(history);
                res(1);
            }
            else {
                vscode.window.showWarningMessage(`
                This file is already checked-out!\nBy: "${history.outBy}"\nOn: <${history.timeOut}>.`, 'OK');
            }
        }
        else {
            activeTextEditor.edit((editor) => {
                editor.insert(new vscode.Position(0, 0), f_Headers.commentHeader(
                    f_Headers.populateCheckOutHeader(t_Headers.out).substring(1), languageId)+'\n');
            });
            res(1);
        }
    });
    
};

const handlerChangeActiveTextEditor = () => {
    if (f_Headers.headerExists(f_Headers.getCurrentHeader())){
        f_SFTP.sftpSyncGet().then (()=>{
            handlerColoredTitleBars();
        });
    }
    else 
        handlerColoredTitleBars();
};

const handlerDidSaveTextDocument = () => {
    var header = f_Headers.getCurrentHeader();

    handlerColoredTitleBars();
    if (f_Headers.headerExists(header)){
        console.log(header);

        var email = f_Config.getUserEmail();
        var history = f_Headers.getHeaderHistory(header);
        
        f_Config.autoSaveDisable();
        if ((history.status == 1) && (history.outBy == email) &&
            (history.inBy == email) && (moment()
            .format('YYYY/MM/DD, hh:mm:ss a') == history.timeIn))

            f_SFTP.sftpSyncSave();

        else if(((history.status == 2) && (history.outBy == email)))

            f_SFTP.sftpSyncSave();
            
        else {

            f_SFTP.sftpSyncGet();
            vscode.window.showWarningMessage('Read Only File!');
        }
    }
}
// this method is called when your extension is activated
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('CheckoutHeader: Now active!');
    
	let checkInHeader = vscode.commands.registerCommand('CheckoutHeader.in', checkIn);
    let checkOutHeader = vscode.commands.registerCommand('CheckoutHeader.out', checkOut);
    
	context.subscriptions.push(checkInHeader);
    context.subscriptions.push(checkOutHeader);

    vscode.window.onDidChangeActiveTextEditor(handlerChangeActiveTextEditor);
    vscode.workspace.onDidSaveTextDocument(handlerDidSaveTextDocument);
    vscode.window.onDidChangeWindowState(handlerChangeActiveTextEditor);
}

//exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}