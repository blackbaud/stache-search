'use strict';

const mock = require('mock-require');
const fs = require('fs-extra');
const btoa = require('btoa');
const EventEmitter = require('events').EventEmitter;

describe('Publish Search', () => {
  let args;
  let emitter;
  let publishSearch;

  const config = {
    appSettings: {
      stache: {
        searchConfig: {
          allowSiteToBeSearched: false
        }
      }
    }
  };

  beforeEach(() => {
    emitter = new EventEmitter();

    mock('./error-handler', function (error) {
      console.log(error);
    });

    mock('fs-extra', {
      existsSync: function (filePath) {
        console.log(`${filePath} exists!`);
        return true;
      },
      readJsonSync: function (filePath) {
        console.log(`${filePath} found!`);
        return {
          test: "Some Example JSON"
        };
      }
    });

    mock('request', function (options) {
      console.log(options.headers.Authorization);
      console.log(options.body);
      console.log(options.uri);
      return emitter;
    });

    mock('path', {
      resolve: function () {
        console.log('We have a path!');
        return './src/stache/search.json';
      }
    });

    args = {
      endpoint: "https://localhost:5000/publisher",
      audienceId: "Audience\\Id",
      clientUserName: "t01\\example",
      clientKey: "apassword"
    };

    publishSearch = mock.reRequire('./publish-search');
  });

  it('should do nothing if search is false', () => {
    spyOn(fs, 'existsSync');
    publishSearch(args, config);
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it('should publish search by default if search is undefined', () => {
    let filePath = './src/stache/search.json';
    spyOn(console, 'log');
    publishSearch(args, undefined);
    expect(console.log).toHaveBeenCalledWith(`${filePath} exists!`);
  });

  it('should error if no search json file is found', () => {
    mock('fs-extra', {
      existsSync: function () {
        console.log('Does not exist!');
        return false;
      }
    });
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);
    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: Search json file does not exist!'));
    expect(console.log).toHaveBeenCalledWith('Does not exist!');
  });

  it('should error if an endpoint is not provided', () => {
    delete args.endpoint;
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);
    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: An endpoint is required to publish stache search data!'));
  });

  it('should error if an audienceId is not provided', () => {
    delete args.audienceId;
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);

    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: An audienceId is required to publish stache search data!'));
  });

  it('should error if a clientUserName is not provided', () => {
    delete args.clientUserName;
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);

    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: Client User Name and Client Key are required to publish stache search data!'));
  });

  it('should error if a clientKey is not provided', () => {
    delete args.clientKey;
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);

    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: Client User Name and Client Key are required to publish stache search data!'));
  });

  it('should post the json file', () => {
    let authCredentials = btoa(`${args.clientUserName}:${args.clientKey}`);
    spyOn(console, 'log');
    publishSearch(args, undefined);
    emitter.emit('data', new Buffer(JSON.stringify({
      access_token: 'test'
    })));
    emitter.emit('end');
    emitter.emit('response', {
      statusCode: 200
    });
    expect(console.log).toHaveBeenCalledWith(args.endpoint);
    expect(console.log).toHaveBeenCalledWith(`https://service-authorization.sky.blackbaud.com/oauth2/token?grant_type=client_credentials&audience_id=${encodeURIComponent(args.audienceId)}`);
    expect(console.log).toHaveBeenCalledWith('Bearer test');
    expect(console.log).toHaveBeenCalledWith(`Basic ${authCredentials}`);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify({ test: "Some Example JSON" }));
    expect(console.log).toHaveBeenCalledWith('200: Search data successfully posted!');
  });

  it('should post the release object if build version and site name are passed in as arguments', () => {
    let authCredentials = btoa(`${args.clientUserName}:${args.clientKey}`);
    spyOn(console, 'log');
    args.buildVersion = 'build version test';
    args.siteName = 'site name test';
    publishSearch(args, undefined);
    emitter.emit('data', new Buffer(JSON.stringify({
      access_token: 'test'
    })));
    emitter.emit('end');
    emitter.emit('response', {
      statusCode: 200
    });
    expect(console.log).toHaveBeenCalledWith(args.endpoint);
    expect(console.log).toHaveBeenCalledWith(`https://service-authorization.sky.blackbaud.com/oauth2/token?grant_type=client_credentials&audience_id=${encodeURIComponent(args.audienceId)}`);
    expect(console.log).toHaveBeenCalledWith('Bearer test');
    expect(console.log).toHaveBeenCalledWith(`Basic ${authCredentials}`);
    expect(console.log).toHaveBeenCalledWith(JSON.stringify({build_version: args.buildVersion, site_name: args.siteName}));
    expect(console.log).toHaveBeenCalledWith('200: Search data successfully posted!');
  });

  it('should throw an error if the authentication post was unsuccessful', () => {
    spyOn(console, 'log');
    publishSearch(args, undefined);
    emitter.emit('error', new Error('Unable to authenticate'));
    expect(console.log).toHaveBeenCalledWith(new Error(`[ERROR]: Unable to retrieve SAS JWT! Unable to authenticate`));
  });

  it('should throw an error if the file post was unsuccessful', () => {
    spyOn(console, 'log');
    publishSearch(args, undefined);
    emitter.emit('data', new Buffer(JSON.stringify({
      access_token: 'test'
    })));
    emitter.emit('end');
    emitter.emit('error', new Error('Unable to post search'));
    expect(console.log).toHaveBeenCalledWith(new Error(`[ERROR]: Unable to post search data! Unable to post search`));
  });

  it('should throw an error if the status code on post !== 200', () => {
    spyOn(console, 'log');
    publishSearch(args, undefined);
    emitter.emit('data', new Buffer(JSON.stringify({
      access_token: 'test'
    })));
    emitter.emit('end');
    emitter.emit('response', {
      statusCode: 500
    });
    expect(console.log).toHaveBeenCalledWith(new Error(`[ERROR]: Unable to post search data! 500`));
  });

  it('should throw an error if unable to read search json file', () => {
    mock('fs-extra', {
      existsSync: function (filePath) {
        console.log(`${filePath} exists!`);
        return true;
      },
      readJsonSync: function () {
        throw new Error('It is broken!');
      }
    });
    publishSearch = mock.reRequire('./publish-search');
    spyOn(console, 'log');
    publishSearch(args, undefined);
    emitter.emit('data', new Buffer(JSON.stringify({
      access_token: 'test'
    })));
    emitter.emit('end');
    expect(console.log).toHaveBeenCalledWith(new Error('[ERROR]: Unable to read search file at ./src/stache/search.json! It is broken!'));
  });

});
