'use strict';

const fs = require('fs-extra');
const mock = require('mock-require');

describe('Remove Search Spec', () => {
  let removeSearchSpec;
  const config = {
    appSettings: {
      stache: {
        search: false
      }
    }
  };

  beforeAll(() => {
    mock('fs-extra', {
      existsSync: function(filePath) {
        if (filePath) {
          console.log('File exists');
          return true;
        }
      },
      unlinkSync: function(filePath) {
        console.log(`File deleted: ${filePath}`);
      }
    });

    mock('path', {
      join: function() {
        return './e2e/stache-search.e2e-spec.ts';
      }
    });
  });

  beforeEach(() => {
    removeSearchSpec = mock.reRequire('./remove-search-spec');
  });

  it('should not remove the file if search is false', () => {
    spyOn(fs, 'existsSync');
    removeSearchSpec([], config);
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it('should not remove the file if search is undefined', () => {
    spyOn(fs, 'existsSync');
    removeSearchSpec([], undefined);
    removeSearchSpec([], {});
    removeSearchSpec([], {
      appSettings: {}
    });
    removeSearchSpec([], {
      appSettings: {
        stache: {}
      }
    });
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it('should remove the file if search is set to true and the file exists', () => {
    const filePath = './e2e/stache-search.e2e-spec.ts';
    config.appSettings.stache.search = true;
    spyOn(console, 'log');
    removeSearchSpec([], config);
    expect(console.log).toHaveBeenCalledWith(`File deleted: ${filePath}`);
    expect(console.log).toHaveBeenCalledWith('File exists');
  });

  it('should do nothing if no file exists', () => {
    mock('fs-extra', {
      existsSync: function () {
        return false;
      },
      unlinkSync: function () {
        console.log('I should not fire!');
      }
    });
    spyOn(console, 'log');
    config.appSettings.stache.search = true;
    removeSearchSpec = mock.reRequire('./remove-search-spec');
    removeSearchSpec([], config);
    expect(console.log).not.toHaveBeenCalledWith('I should not fire!');
  });

  it('should throw an error if a problem occurs with deleting the file', () => {
    mock('path', {
      join: function() {
        throw new Error('Test error');
      }
    });
    removeSearchSpec = mock.reRequire('./remove-search-spec');
    config.appSettings.stache.search = true;
    let test = function () {
      return removeSearchSpec([], config);
    }
    expect(test).toThrowError('[ERROR]: Unable to remove stache search template from e2e directory.');
  });

});
