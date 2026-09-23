import sharp from 'sharp';
sharp.cache(false);
sharp.concurrency(1);
export async function prepareHostedPhoto(image){
 return (await sharp(image,{limitInputPixels:40000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer()).toString('base64');
}
