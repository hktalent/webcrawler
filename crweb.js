#!/usr/bin/env node
var fs = require('fs'),
    Crawler = require("crawler"),
    n_maxLs = 333,
    level = require('level'),path = require('path'),
    g_url = require('url'),
    g_oUrls = {},
    inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter,
	program = require('commander');

// node index.js -u "http://http.kali.org/kali/dists/" --filter "C=" -o ./ -m 8
EventEmitter.prototype._maxListeners = n_maxLs;

EventEmitter.defaultMaxListeners = n_maxLs;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

program.version("web crawler 1.0")
	.option('-h, --header [value]', 'http header')
    .option('-u, --url [value]', 'url')
    .option('-f, --filter [value]', 'filter')
    .option('-r, --recursive', 'directories recursively')
    .option('-m, --max [value]', 'mac connections')
    .option('-v, --verbose', 'show logs')
	.option('-t, --timeout [value]', 'timeout,default 3s')
	.option('-o, --out [value]', 'out path')
	.parse(process.argv);

    var _fnNull = function(e){if(program && program.verbose)console.log(e)};
process.on('uncaughtException', _fnNull);
process.on('unhandledRejection', _fnNull);

    
function fnDoUrl(program)
{
// headers
var oHds = {"content-encoding":"none","connection": "close","user-agent":"Mozilla/5.0 (win; Intel ms win 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36"}, 
    c = null,
    bR = program.recursive || false,
    szIndex = ".index.html",
    szPath = program.out || "./",
    oHeaders = {
        headers:oHds,
        retries:2,
        skipDuplicates:true,
        agent: false, pool: {maxSockets: 200},
        agentOptions: {
            rejectUnauthorized: false
          },
        rejectUnauthorized:false,
        followRedirect:true,     // follow HTTP 3xx responses as redirects (default: true).
        followAllRedirects:false,// follow non-GET HTTP 3xx responses as redirects (default: false)
        'connection':'close',
        maxConnections:program.max || 33,
        encoding:null,
        jQuery:false,
        gzip:false,
        timeout:program.timeout||15000};
if(program.header)
{
    var a = program.header.split(/\n/);
    for(var i = 0; i < a.length; i++)
    {
        var aTmp = a[i].split(/:\s*/);
        oHds[aTmp[0].toString().toLowerCase()] = aTmp[1];
    }
}
decodeURI = decodeURIComponent;encodeURI = encodeURIComponent;
// decodeURI=encodeURI=function(s){return s}

function fnEDUrl(uri,fnCbk)
{
    var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(uri);
    
    aF[2] = aF[2].replace(/([^\/]+)/gmi, function(a,b)
    {
        try{a = fnCbk(a);}catch(e){}
        // console.log(a)
        return a
    });
    return aF[1] + aF[2];
}
function parseUrl(url)
{
    var oU = g_url.parse(url);
    if(!oU.port)
    {
        if("https:" == oU.protocol)
        {
            oU.port = 443;
        }
        else //if("http" == oU.protocol)
            oU.port = 80;
    }
    return oU;
}

var dbPath = process.env.DB_PATH || path.join(__dirname, 'mydb1'),
    db = level(dbPath);
function doQueue(s)
{
    var hst = parseUrl(s);
    // console.log(hst)
    s = [hst.protocol,"//", hst.hostname,":",hst.port || 80,"/"].join("");
    if(!(/(\.gov)|(\.edu)|((\d{1,3}\.){3}\d{1,3})/gmi.test(hst.hostname)))
    {
        // console.log("skip: " + hst.hostname)
        return;
    }
    // console.log(s)
    db.get(s, function(err, value) {  
        if (err || !value)
        {
            db.put(s,1, function(err) {  
                if (err) {
                    console.error('error putting key 1:', err);
                }
            });
            if(!g_oUrls[s])
            c.queue({
                uri: fnEDUrl(s,decodeURI)
            });
            g_oUrls[s]="1";
        }
    });
}


function fnDoHtmlFile(body, url)
{
    var s = body.toString(), aR = /\b(http(s)*:\/\/[^"'><]+)\b/gmi,aT;
    var fnFck = doQueue;
    var odU = url;
    while(aT = aR.exec(s))
    {
        url = odU;
        // if("../" == aT[1] || "#" == aT[1]|| "/" == aT[1] || -1 < aT[1].indexOf("javascript:"))continue;
        // console.log("=======" + aT[1])
        if(aT[1].startsWith("http"))
        {
            // if(-1 < aT[1].indexOf(url))continue;
            // else 
            fnFck(aT[1]);
        }
    }
}

// If-Modified-Since
oHeaders.preRequest = function(options, done) {
    
    // console.log(options)
    var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(options.uri);
    if(aF && 2 < aF.length)
    {
        aF[2] = aF[2].replace(/\/+/gmi, "/");
        options.uri = aF[1] + aF[2];
    }
    // console.log(aF)
    // console.log(szPath)
    var oStat = fs.existsSync(szPath + aF[2]) && fs.statSync(szPath + aF[2]) ||
        fs.existsSync(szPath + aF[2] + szIndex) && fs.statSync(szPath + aF[2] + szIndex) || null;
    if(oStat)
    {
        options.headers["if-modified-since"] = new Date(oStat.ctime).toGMTString();
        oStat = null;
        // console.log(options.headers);
    }
    if(program.filter)
    {
        var r = new RegExp(program.filter,"gmi");
        if(r.test(options.uri))return;
    }
    options.uri = fnEDUrl(options.uri,encodeURI);
    aF = null;
    console.log("start " + options.uri);
    done();
};

oHeaders.callback = function(err, res, done)
{
    if(err)
    {
        console.log(err);
        done();
        return;
    }
    if(200 != res.statusCode)
    {
        if(304 ==  res.statusCode && bR)
        {
            var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(res.options.uri),szTmp = '';
            if(fs.existsSync(szTmp = szPath + aF[2] + szIndex))
                console.log("parse " + szTmp),
                fnDoHtmlFile(fs.readFileSync(szTmp).toString(), res.options.uri);
            aF = null;
        }
        else if(404 ==  res.statusCode)
        {
            // how fix gbk?
            // console.log([res.options.uri, res.statusCode]);
        }
    }
    // save file, push 
    else if(res.statusCode == 200)
    {
        res.options.uri = fnEDUrl(res.options.uri, decodeURI);
        var oHdTmp = res.headers,aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(res.options.uri);
        // var xxs = szPath + aF[2].replace(/\/[^\/]*$/gmi,'/');
        // if(!fs.existsSync(xxs))
        //    fs.mkdirSync(xxs,{recursive:true});
        // 解析，并进行钻取
        if(/text\/html/g.test(oHdTmp['content-type']))
        {
            fnDoHtmlFile(res.body, res.options.uri);
        }
    }
    done();
};

if(program.url)
{
    c = new Crawler(oHeaders);
    c.queue({
        uri:program.url
    });
    c.on("error",function(s)
    {
        console.log(s)
    });
}

}
if(program.url)fnDoUrl(program)
inherits(fnDoUrl, EventEmitter);
module.exports = fnDoUrl;