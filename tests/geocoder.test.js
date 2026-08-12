// Jest + nock test for services/geocoder.js
const nock = require('nock');
const { search, reverse } = require('../services/geocoder');

const GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org';

describe('geocoder service (authored by g-radio)', () => {
  afterEach(() => nock.cleanAll());

  test('search returns parsed json', async () => {
    const q = '1600 Pennsylvania Ave NW';
    const resp = [{ display_name: 'The White House', lat: '38.897675', lon: '-77.036547' }];

    nock(GEOCODER_URL)
      .get('/search')
      .query(true)
      .reply(200, resp);

    const result = await search(q, { limit: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].display_name).toBe('The White House');
  });

  test('reverse returns parsed json', async () => {
    const lat = '38.897675';
    const lon = '-77.036547';
    const resp = { display_name: 'The White House', lat, lon, address: { road: 'Pennsylvania Avenue NW' } };

    nock(GEOCODER_URL)
      .get('/reverse')
      .query(true)
      .reply(200, resp);

    const result = await reverse(Number(lat), Number(lon));
    expect(result.display_name).toBe('The White House');
    expect(result.address).toHaveProperty('road');
  });
});
