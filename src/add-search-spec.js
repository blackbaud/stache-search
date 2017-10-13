'use strict';

const path = require('path');
const fs = require('fs-extra');
const utils = require('./utils/shared');

const errorHandler = require('./error-handler');

const template = `// Use browser to access other sites (that are running angular)
import { browser, element, by } from 'protractor';

// Use SkyHostBrowser to access your locally served SPA
import { SkyHostBrowser } from '@blackbaud/skyux-builder/runtime/testing/e2e';

const fs = require('fs');
const path = require('path');

const mapFilePaths = (config: any) => {
  let routes = config.runtime.routes
    .map((route: any) => {
      return '/' + route.routePath;
    })
    .filter((route: string) => {
      if (route.indexOf('*') > -1) {
        return false;
      }
      if (route === '/') {
        return false;
      }
      return route;
    });
  routes.push('/');
  return routes;
};

describe('Search Results', () => {
  let files: string[];

  function removeUnnecessaryElements() {
    Array.from(
      document.querySelectorAll(
        '.stache-sidebar, .stache-breadcrumbs, .stache-table-of-contents'
      )
    ).forEach(el => el.remove());
  }

  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 500000;
  });

  it('should generate search results', (done) => {
    let config: any = browser.params.skyPagesConfig;
    let buildConfigPath = path.resolve(process.cwd(), 'skyuxconfig.build.json');
    let baseConfig: any = require('../skyuxconfig.json');
    let buildConfig: any = fs.existsSync(buildConfigPath) ? require(buildConfigPath) : undefined;
    files = mapFilePaths(config);
    let doesSearchConfigExist = (
      config.skyux &&
      config.skyux.appSettings &&
      config.skyux.appSettings.stache &&
      config.skyux.appSettings.stache.searchConfig
    );

    let siteName: string = config.skyux.name;
    if (!siteName) {
      const packageFile = require('../package.json');
      siteName = packageFile.name;
    }

    let url: string;
    if (buildConfig) {
      url = buildConfig.host.url;
    } else if (baseConfig.host) {
      url = baseConfig.host.url;
    } else {
      url = config.skyux.host.url;
    }

    let isInternal: boolean = doesSearchConfigExist ? config.skyux.appSettings.stache.searchConfig.is_internal : true;
    let content: any = {
      site_name: siteName,
      stache_page_search_data: []
    };

    function writeSearchFile(searchDirPath: string) {
      return new Promise((resolve, reject) => {
        fs.writeFile(
          path.join(searchDirPath, 'search.json'),
          JSON.stringify(content),
          (error: any) => {
            error ? reject(error) : resolve();
          }
        );
      });
    }

    function scrapePageContent(file: string) {
      let pageContent: any = {
        host: url,
        site_name: siteName,
        path: file,
        is_internal: isInternal
      };

      return SkyHostBrowser
        .get(file, 3000)
        .then(() => {
          return browser.executeScript(removeUnnecessaryElements);
        })
        .then(() => {
          return element(by.css('.stache-wrapper')).getText();
        })
        .then((text: string) => {
          pageContent['text'] = text.replace(/\n/g, ' ');
          return element(by.css('.stache-page-title, .stache-tutorial-heading, h1')).getText();
        })
        .then((text: string) => {
          pageContent['title'] = text;
          return pageContent;
        })
        .catch((error: any) => {
          if (error.name === 'NoSuchElementError') {
            console.log(
              'Must have the <stache> tag and a pageTitle on page '
              + file + ' to scrape content.'
            );
            return pageContent;
          } else if (error.message.indexOf('Angular could not be found on the page') > -1) {
            console.log('Angular not found on page ' + file + '. Skipping.');
            return pageContent;
          } else {
            throw new Error(error);
          }
        });
    }

    Promise.all(files.map(file => {
      return scrapePageContent(file);
    }))
      .then(pageContents => {
        let searchDirPath = path.join(
          __dirname,
          '..',
          'src',
          'stache',
          'search'
        );

        content.stache_page_search_data = pageContents;

        if (!fs.existsSync(searchDirPath)) {
          fs.mkdirSync(searchDirPath);
        }
        return writeSearchFile(searchDirPath);
      })
      .then(() => done())
      .catch((error: any) => {
        console.log('ERROR', error);
        expect(error).toBeNull();
        done();
      });
  });
});
`;

function addSearchSpecToProject(argv, config) {
  if (utils.readConfig(config, 'allowSiteToBeSearched') === false) {
    return; 
  }

  try {
    let filePath = path.join(process.cwd(), 'e2e');
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath);
    }
    fs.writeFileSync(path.join(filePath, 'stache-search.e2e-spec.ts'), template);
  } catch (error) {
    return errorHandler(new Error('[ERROR]: Unable to add stache search template to e2e directory.'), config);
  }
}

module.exports = addSearchSpecToProject;