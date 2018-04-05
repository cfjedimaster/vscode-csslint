/* --------------------------------------------------------------------------------------------
 * Copyright (c) Raymond Camden. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, 
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeResult
} from 'vscode-languageserver';

let cssLint = require('csslint').CSSLint;

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
connection.onInitialize((): InitializeResult => {
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			}
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

// The settings interface describe the server relevant settings part
interface Settings {
	cssLanguageClient: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
  clearProblemsOnDocumentClose: boolean;
	maxNumberOfProblems: number;
}

// hold the clearProblemsOnDocumentClose setting
let clearProblemsOnDocumentClose: boolean;

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
  let settings = <Settings>change.settings;
  clearProblemsOnDocumentClose = settings.cssLanguageClient.clearProblemsOnDocumentClose || false;
	maxNumberOfProblems = settings.cssLanguageClient.maxNumberOfProblems || 100;
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let text = textDocument.getText();
	var issues = cssLint.verify(text);

	for(var i=0;i<Math.min(issues.messages.length,maxNumberOfProblems);i++) {
		var issue = issues.messages[i];
		var severity:DiagnosticSeverity;

		if(issue.type === "warning") {
			severity = DiagnosticSeverity.Warning;
		} else {
			severity = DiagnosticSeverity.Error;
		}
		diagnostics.push({
			severity:severity,
			range: {
				start: {line:issue.line-1, character:issue.col-1},
				end: {line:issue.line-1, character:issue.col-1}
			},
			message: issue.message,
			source:'ex'
		});
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(() => {
	// Monitored files have change in VSCode
	connection.console.log('We recevied an file change event');
});



/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

documents.onDidClose((event) => {
  if (clearProblemsOnDocumentClose === true) {
    const uri = event.document.uri;

    connection.sendDiagnostics({ uri: uri, diagnostics: [] });
  }
});

// Listen on the connection
connection.listen();
