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
        srcLine = '"' + srcLine.replace(/"/g, '\"') + '",\n';
    }
    return srcLine;
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