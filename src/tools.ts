'use strict';

export function getFileNoExtension(filePath: string): string {
    let index = filePath.lastIndexOf(".");
    if (index !== -1) {
        return filePath.substr(0, index);
    } else {
        return filePath;
    }
}

export function quoteFileName(filePath: string): string {
    if (filePath.match(/\s/)) {
        filePath = '"' + filePath.replace(/"/g, '\"') + '"';
    }
    return filePath;
}

export function quoteLine(srcLine: string): string {
    if (srcLine.match(/\s/)) {
        srcLine =  srcLine.replace(/"/g, '\"') ;
    }
    return srcLine;
}

export function filewalker(dir:string, done:any): any{
    let results = [];
    const path = require('path');
    const fs = require('fs');
    fs.readdir(dir, function(err, list) {
        if (err) return done(err);

        var pending = list.length;

        if (!pending) return done(null, results);

        list.forEach(function(file){
            file = path.resolve(dir, file);

            fs.stat(file, function(err, stat){
                // If directory, execute a recursive call
                if (stat && stat.isDirectory()) {
                    // Add directory to array [comment if you need to remove the directories from the array]
                    results.push(file);

                    filewalker(file, function(err, res){
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);

                    if (!--pending) done(null, results);
                }
            });
        });
    });
    return results;
}

export function replaceVar(originalStr: string, varName: string, value: string): string {
    let regx = new RegExp("\\$\\{" + varName + "([\\W][^ }]+)?\\}", "g");

    if (value.match(/\s/)) {
        value = value.replace(/"/g, '\\"');
        return originalStr.replace(regx, '"' + value + '$1"');
    }

    return originalStr.replace(regx, value + '$1');
}


export function unwrap(proxy): object {
    if (typeof proxy !== 'object') {
        return proxy;
    }
    let obj = {};
    Object.keys(proxy).forEach(function (key) {
        let s = proxy[key];
        let u = unwrap(s);
        obj[key] = u;
    });
    return obj;
}