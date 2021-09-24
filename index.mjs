/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */
import md5 from 'md5';
import rssToJson from 'rss-to-json';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import Transmission from 'transmission';
import config from './config.mjs';

const TMP = path.join(os.tmpdir(), 'transmission-rss');

const transmission = new Transmission(config.server);

function getLink(item) {
    if (item.enclosures && item.enclosures[0] && item.enclosures[0].url) {
        return item.enclosures[0].url;
    }

    return item.link;
}

function getGuid(item) {
    return item.guid || md5(getLink(item));
}

function getTitle(item) {
    return item.title;
}

async function exists(path) {
    try {
        await fs.access(path);
    } catch (e) {
        return false;
    }

    return true;
}

function hasDownloaded(guid) {
    return exists(path.join(TMP, guid));
}

async function setHasDownloaded(guid) {
    if (!(await exists(TMP))) {
        await fs.mkdir(TMP, { recursive: true });
    }

    return fs.writeFile(path.join(TMP, guid), '');
}

async function download(item) {
    return new Promise((resolve, reject) => {
        transmission.addUrl(
            getLink(item),
            { 'download-dir': config.dir },
            (err, res) => {
                if (err) {
                    reject(err);
                }

                resolve(res);
            }
        );
    });
}

async function main() {
    console.log('='.repeat(80));
    console.log(new Date(Date.now()));

    for await (const url of config.feeds) {
        const { items: rawItems } = await rssToJson.parse(url);
        for await (const item of rawItems) {
            const guid = getGuid(item);

            if (await hasDownloaded(guid)) {
                console.log(`[SKIP] ${getTitle(item)}`);

                continue;
            }

            await download(item);
            await setHasDownloaded(guid);

            console.log(`[ADD ] ${getTitle(item)}`);
        }
    }
}

main();
