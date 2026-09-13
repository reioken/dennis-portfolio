// Small bitmap lettering: every stroke is a whole canvas pixel, with no
// browser font rasterization or antialiased edges before the scene is scaled.
const glyphs={
  '0':['01110','10001','10001','10001','10001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['0','0','0','0','0','1','1'],
  'm':['00000','00000','11010','10101','10101','10101','10101'],
  ' ':['00','00','00','00','00','00','00']
};
export const pixelTextWidth=text=>Math.max(0,[...text].reduce((n,c)=>n+(glyphs[c]||glyphs[' '])[0].length+1,0)-1);
export function drawPixelText(ctx,text,x,y){
  let left=Math.round(x);const top=Math.round(y);
  for(const c of text){const rows=glyphs[c]||glyphs[' '];
    for(let row=0;row<7;row++)for(let col=0;col<rows[row].length;col++)if(rows[row][col]==='1')ctx.fillRect(left+col,top+row,1,1);
    left+=rows[0].length+1;
  }
}
