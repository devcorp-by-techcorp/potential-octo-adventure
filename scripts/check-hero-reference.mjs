import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heroSlides } from '../web/src/data/hero-slides.js';

const source = readFileSync('_ds/StudioSuite-Mobile.dc.html', 'utf8');
const marketing = source.slice(source.indexOf('this.MARKETING ='), source.indexOf('this.HERO_SLIDES ='));
const slides = source.slice(source.indexOf('this.HERO_SLIDES ='), source.indexOf('this.PROCESS ='));
const expected = [{ category: 'The studio', id: '1511285560929-80b456fea0bc',
  title: marketing.match(/headline:'([^']+)'/)[1], description: marketing.match(/lede:'([^']+)'/)[1] }];
for (const match of slides.matchAll(/kicker:'([^']+)',pid:'([^']+)',\s*headline:'([^']+)',\s*lede:'([^']+)'/g)) {
  expected.push({ category: match[1], id: match[2], title: match[3], description: match[4] });
}
assert.equal(expected.length, 7);
assert.deepEqual(heroSlides.map(({ category, id, referenceImageId, title, description }) => ({ category, id: referenceImageId || id, title, description })), expected);


assert.deepEqual(heroSlides.filter(slide => slide.referenceImageId).map(slide => [slide.referenceImageId, slide.id]), [
  ['1519671482749-fd09be7ccebf', '1511895426328-dc8714191300'],
  ['1583939411023-14783179e581', '1558636411-95b6f3dbfa6a'],
  ['1523438885200-e635ba2c371e', '1535571393765-ea44927160be'],
  ['1591604466107-ec97de577aff', '1552053831-71594a27632d'],
]);

console.log('hero-reference: seven slides, ordered categories, source traceability and bundled copy match _ds.');
