import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareHostedPhoto} from '../hosted-photo.mjs';
test('hosted photo conversion bounds size and removes identifying metadata',async()=>{
 const input=await sharp({create:{width:2400,height:1200,channels:3,background:'white'}}).withMetadata({exif:{IFD0:{Artist:'private fixture'}}}).jpeg().toBuffer();
 const output=Buffer.from(await prepareHostedPhoto(input),'base64');const info=await sharp(output).metadata();
 assert.equal(info.format,'jpeg');assert.equal(info.width,1600);assert.equal(info.height,800);assert.equal(info.exif,undefined);
 await assert.rejects(()=>prepareHostedPhoto(Buffer.from('not an image')));
});
