import { lookHeader, type Look } from "./shader-looks.js";

/**
 * The looks that only run through the layer stack (`modules/shader-stack`): the ones that
 * rework the layers under them (glass, halftone, dithering), grain as a layer, and aurora,
 * silk and cells. All are written for Lintel from general techniques: refraction through a
 * lens profile, a rotated dot screen, an ordered threshold matrix, distance-to-nearest-point
 * cells. With nothing under them (`lo` is 1) they draw from their own soft moving field.
 */

/** What reworks the layers below reads them through. `ls` allows for the texture's size. */
const filterHeader = `${lookHeader}
uniform sampler2D lb;uniform vec2 ls;
vec4 bl(vec2 p){return texture2D(lb,p*ls);}
float field(vec2 p){float w=r.x/r.y;vec2 q=turn(vec2(p.x*w,p.y),w);float s=t*.06;
return smoothstep(.2,.8,n(q*1.4+vec2(s,-s*.7))*.65+n(q*3.1+vec2(-s,s))*.35);}
float tone(vec2 p){vec4 u=bl(p);return mix(1.-dot(u.rgb,vec3(.3,.59,.11)),field(p),lo);}
`;

const glass = `${filterHeader}
vec4 seen(vec2 p){return mix(bl(p),vec4(mix(a,b,field(p)),1.),lo);}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w);float g,rim;vec2 o;float sway=sin(t*.25)*.02;
if(pt<.5){g=fract(p.x*dt+sway)-.5;o=vec2(g,0.);rim=abs(g)*2.;}
else if(pt<1.5){vec2 q=p-vec2(w*.5,.5);g=fract(length(q)*dt-t*.03)-.5;o=normalize(q+1e-4)*g;rim=abs(g)*2.;}
else{vec2 q=fract(p*dt+sway)-.5;o=q;rim=max(abs(q.x),abs(q.y))*2.;}
o*=(.4+2.2*k)/dt;float y=-an;o=mat2(cos(y),sin(y),-sin(y),cos(y))*o;vec2 q=uv+vec2(o.x/w,o.y);
float z=so*.016;
vec4 col=(seen(q)*2.+seen(q+vec2(z,0.))+seen(q-vec2(z,0.))+seen(q+vec2(0.,z))+seen(q-vec2(0.,z)))/6.;
float lit=pt<1.5?g:o.x*dt;col.rgb*=1.+lit*(.18+.34*k);col.rgb+=col.a*pow(rim,14.)*.14;gl_FragColor=vec4(min(col.rgb,col.a),col.a);}`;

const halftone = `${filterHeader}
void main(){float size=max(dt*d,2.);float q=cos(an),s=sin(an);mat2 R=mat2(q,s,-s,q);
vec2 g=R*gl_FragCoord.xy/size,id=floor(g)+.5;vec2 at=(id*size*R)/r;
float dot0=sqrt(clamp(tone(at)*(.35+1.3*k),0.,1.))*.74;
float rim=max(so*.45,1.2/size);float ink=1.-smoothstep(dot0-rim,dot0+rim,length(g-id));
vec3 inked=mix(a,bl(at).rgb,pt*(1.-lo));gl_FragColor=vec4(mix(b,inked,ink),1.);}`;

const dither = `${filterHeader}
float b2(vec2 p){p=floor(p);return fract(p.x*.5+p.y*p.y*.75);}
float b4(vec2 p){return b2(p*.5)*.25+b2(p);}
float b8(vec2 p){return b4(p*.5)*.25+b2(p);}
void main(){float size=max(dt*d,1.);vec2 g=floor(gl_FragCoord.xy/size);vec2 at=(g+.5)*size/r;
float ink=step(b8(g)+.001,(tone(at)-.5)*(.5+1.5*k)+.5);
vec3 inked=mix(a,bl(at).rgb,pt*(1.-lo));gl_FragColor=vec4(mix(b,inked,ink),1.);}`;

const grain = `${lookHeader}
void main(){vec2 g=floor(gl_FragCoord.xy/(d*max(sc,.5)));float v=h(g+floor(t*12.)*.37);
float al=clamp(k,0.,1.)*.42;gl_FragColor=vec4(vec3(v)*al,al);}`;

const aurora = `${lookHeader}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w);float s=t*.07,u=soft();
float x=p.x*1.5+f(vec2(p.x*.6+s,s*.7))*2.2;
float y=p.y-.56-.15*sin(x*1.7+s*2.)-.07*sin(x*3.1-s);
float band=y>0.?exp(-y*3.2*u):exp(-y*y*46.*u);
float rays=.5+.5*n(vec2(x*dt,s*1.6));
float al=clamp(band*rays*(.3+1.1*k),0.,1.);
vec3 col=mix(a,b,clamp(y*2.2+.3,0.,1.));col=mix(col,c,hc*smoothstep(.45,.95,band*rays));
al=clamp(al+(h(gl_FragCoord.xy+fract(t))-.5)/96.,0.,1.);gl_FragColor=vec4(col*al,al);}`;

const silk = `${lookHeader}
float cloth(vec2 p){float s=t*.05;return sin(p.x*2.1+2.4*n(p*.8+s))+.6*sin(p.y*3.+p.x*1.2+2.*n(p*.6-s+4.));}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w)*3.2;float e0=.012;
float c0=cloth(p),depth=.3+.8*k;
vec3 N=normalize(vec3((c0-cloth(p+vec2(e0,0.)))/e0*depth,(c0-cloth(p+vec2(0.,e0)))/e0*depth,1.));
vec3 L=normalize(vec3(-.45,.6,.66));float l=clamp(dot(N,L),0.,1.);
float shine=pow(max(reflect(-L,N).z,0.),10.+30.*(1.-so));
vec3 col=mix(a,b,smoothstep(.25,.98,l))+mix(b,c,hc)*shine*.3;
col+=(h(gl_FragCoord.xy+fract(t))-.5)/128.;gl_FragColor=vec4(col,1.);}`;

const cells = `${lookHeader}
void main(){float w=r.x/r.y;vec2 p=turn(vec2(uv.x*w,uv.y),w)*dt;vec2 i=floor(p),g=fract(p),id=i;float d1=9.,d2=9.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 q=vec2(h(i+o),h(i+o+7.3));
vec2 v=o+.5+.3*sin(t*.22+6.283*q)-g;float l=dot(v,v);if(l<d1){d2=d1;d1=l;id=i+o;}else if(l<d2)d2=l;}
float line=smoothstep(0.,.015+.3*so,sqrt(d2)-sqrt(d1));
vec3 col=mix(a,b,h(id+.5));col=mix(col,c,hc*step(.72,h(id+3.5)));
gl_FragColor=vec4(col*mix(1.-.65*k,1.,line),1.);}`;

const ink = ["ink", "paper"];
const inkDefaults = ["#c4bdaf", "#f6f4ef"];
const washes = { colours: ["one", "two", "three"], pointer: false };

export const extraLooks: Record<string, Look> = {
  glass: {
    shader: glass,
    resolution: 0.75,
    covers: true,
    colours: ["one", "two"],
    defaults: ["#c9d6df", "#efe7dc"],
    pointer: false,
    detail: 14,
    filter: true,
  },
  halftone: {
    shader: halftone,
    resolution: 1,
    covers: true,
    colours: ink,
    defaults: inkDefaults,
    pointer: false,
    detail: 9,
    filter: true,
  },
  dither: {
    shader: dither,
    resolution: 1,
    covers: true,
    colours: ink,
    defaults: inkDefaults,
    pointer: false,
    detail: 3,
    filter: true,
  },
  grain: {
    shader: grain,
    resolution: 1,
    covers: false,
    colours: [],
    defaults: [],
    pointer: false,
  },
  aurora: {
    ...washes,
    shader: aurora,
    resolution: 0.5,
    covers: false,
    defaults: ["#3fbf9f", "#5a6fd8", ""],
    detail: 7,
  },
  silk: {
    ...washes,
    shader: silk,
    resolution: 0.6,
    covers: true,
    defaults: ["#2b2a33", "#b9a7c9", ""],
  },
  cells: {
    ...washes,
    shader: cells,
    resolution: 0.75,
    covers: true,
    defaults: ["#e9e4da", "#d5dcd8", ""],
    detail: 5,
  },
};
