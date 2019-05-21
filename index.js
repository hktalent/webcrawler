#!/usr/bin/env node
var fs = require('fs'),
    Crawler = require("crawler"),
	program = require('commander');

/*

*/
program.version("web crawler 1.0")
	.option('-h, --header [value]', 'http header')
    .option('-u, --url [value]', 'url')
    .option('-r, --recursive', 'directories recursively')
    .option('-m, --max [value]', 'mac connections ')
	.option('-t, --timeout [value]', 'timeout,default 3s')
	.option('-o, --out [value]', 'out path')
	.parse(process.argv);

// headers
var oHds = {"content-encoding":"none","connection": "close","user-agent":"SVN/1.30(x66_win)serf/9"}, 
    c = null,
    bR = program.recursive || false,
    szIndex = ".index.html",
    szPath = program.out || "./",
    oHeaders = {
        headers:oHds,
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
decodeURI = decodeURIComponent;
encodeURI = encodeURIComponent;

function fnEDUrl(uri,fnCbk)
{
    var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(uri);
    
    aF[2] = aF[2].replace(/([^\/]+)/gmi, function(a,b)
    {
        a = fnCbk(a);
        // console.log(a)
        return a
    });
    return aF[1] + aF[2];
}

function fnDoHtmlFile(body, url)
{
    var s = body.toString(), aR = / href=["']([^"'><]+)["']/gmi,aT;
    while(aT = aR.exec(s))
    {
        if("../" == aT[1])continue;
        c.queue({
            uri: fnEDUrl(url +  aT[1],decodeURI)
        });
    }
}

// If-Modified-Since
oHeaders.preRequest = function(options, done) {
    var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(options.uri),
    oStat = fs.existsSync(szPath + aF[2]) && fs.statSync(szPath + aF[2]) ||
        fs.existsSync(szPath + aF[2] + szIndex) && fs.statSync(szPath + aF[2] + szIndex) || null;
    if(oStat)
    {
        options.headers["if-modified-since"] = new Date(oStat.ctime).toGMTString();
        oStat = null;
        // console.log(options.headers);
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
        return;
    }
    if(200 != res.statusCode)
    {
        if(304 ==  res.statusCode && bR)
        {
            var aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(res.options.uri);
            if(fs.existsSync(szPath + aF[2] + szIndex))
            console.log("parse " + szPath + aF[2] + szIndex),fnDoHtmlFile(fs.readFileSync(szPath + aF[2] + szIndex).toString(), res.options.uri);
            aF = null;
        }
        else if(404 ==  res.statusCode)
        {
            // how fix gbk?
            console.log([res.options.uri, res.statusCode]);
        }
    }
    // save file, push 
    else if(res.statusCode == 200)
    {
        res.options.uri = fnEDUrl(res.options.uri, decodeURI);
        var oHdTmp = res.headers,aF = /(http[s]?:\/\/[^\/]+)(\/.*)$/gmi.exec(res.options.uri);
        fs.mkdirSync(szPath + aF[2].replace(/\/[^\/]*$/gmi,'/'),{recursive:true});
        // 解析，并进行钻取
        if(/^text\/html/g.test(oHdTmp['content-type']))
        {
            fnDoHtmlFile(res.body, res.options.uri);
        }
        // date: 'Mon, 20 May 2019 16:00:57 GMT',
        var oDate = null;
        // console.log(oHdTmp['date'])
        if(oHdTmp['date'])oDate = new Date(oHdTmp['date']);
        else oDate = new Date();
        // console.log(res.body.toString())
        if(aF[2].endsWith("/"))aF[2] += szIndex;
        var szFnT = szPath + aF[2],
            oTs = fs.createWriteStream(szFnT);
        oTs.on("finish",function()
        {
            fs.utimes(szFnT,oDate, oDate,(e)=>{});
        });
        oTs.write(res.body);
    }
    done();
};

if(program.url)
{
    c = new Crawler(oHeaders);
    c.queue({
        uri:program.url
    });
}