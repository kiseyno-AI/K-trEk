export const vertexShader = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

export const fragmentShader = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uLongitude;
uniform float uLatitude;
uniform float uMapStyle;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform sampler2D uKoreaMask;
const float PI = 3.14159265359;
float hash(vec2 p) {
  p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y);
}
vec3 rotateX(vec3 p,float a) {
  float c=cos(a),s=sin(a); return vec3(p.x,c*p.y+s*p.z,-s*p.y+c*p.z);
}
vec3 rotateY(vec3 p,float a) {
  float c=cos(a),s=sin(a); return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
}
void main() {
  vec2 p=gl_FragCoord.xy/uResolution*2.0-1.0;
  p.x*=uResolution.x/uResolution.y;
  vec2 q=(p-uCenter)/uRadius;
  float sphere=dot(q,q);
  vec3 color=vec3(.001,.004,.009);
  color+=step(.9984,hash(floor(p*520.0)))*vec3(.5,.7,.95);
  if(sphere<=1.0) {
    vec3 normal=vec3(q,sqrt(max(0.0,1.0-sphere)));
    vec3 world=rotateY(rotateX(normal,uLatitude),uLongitude);
    vec2 uv=vec2(atan(world.x,world.z)/(2.0*PI)+.5,asin(clamp(world.y,-1.0,1.0))/PI+.5);
    vec2 geo=vec2((uv.x-.5)*360.0,(uv.y-.5)*180.0);
    vec2 koreaUV=(geo-vec2(116.0,27.0))/vec2(23.0,17.0);
    vec2 land=vec2(0.0);
    if(all(greaterThanEqual(koreaUV,vec2(0.0)))&&all(lessThanEqual(koreaUV,vec2(1.0))))
      land=texture(uKoreaMask,koreaUV).rg;
    float focus=uMapStyle;
    vec3 regional=vec3(.003,.012,.021)+land.r*vec3(.008,.025,.029)+land.g*vec3(.004,.01,.015);
    vec3 surface=regional,city=vec3(0.0);
    if(focus<1.0) {
      vec3 day=texture(uDay,uv).rgb;
      vec3 night=texture(uNight,uv).rgb;
      float clouds=texture(uClouds,uv).r;
      float daylight=smoothstep(-.18,.38,dot(normal,normalize(vec3(-.85,.18,-.5))));
      city=pow(night,vec3(1.35))*vec3(2.2,1.05,.35)*(1.0-smoothstep(.12,.52,daylight))*2.0*(1.0-focus);
      surface=mix(day*(.008+daylight*.28)+vec3(.18)*clouds*daylight*.24,regional,focus);
    }
    color=surface+city+vec3(.12,.42,.72)*pow(1.0-normal.z,3.2)*.72;
  } else {
    float air=smoothstep(1.085,1.0,sqrt(sphere));
    color+=vec3(.08,.38,.72)*air*air*.72;
  }
  color=pow(color/(color+vec3(1.0)),vec3(1.0/2.2));
  outColor=vec4(color*max(.5,1.0-.32*pow(length(p)*.55,2.2)),1.0);
}`;

export const geographicVertexShader = `#version 300 es
precision highp float;
in vec4 aGeo;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uLongitude;
uniform float uLatitude;
uniform float uPixelRatio;
uniform float uPointSize;
uniform float uRing;
uniform float uStrengthBoost;
uniform float uTime;
out float vFront;
out float vShimmer;
out float vStrength;
void main() {
  float lon=radians(aGeo.x)-uLongitude,lat=radians(aGeo.y);
  vec3 world=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
  vec3 view=vec3(world.x,cos(uLatitude)*world.y-sin(uLatitude)*world.z,sin(uLatitude)*world.y+cos(uLatitude)*world.z);
  vec2 p=view.xy*uRadius+uCenter;
  gl_Position=vec4(p.x*uResolution.y/uResolution.x,p.y,0.0,1.0);
  float vSeed=fract(sin(dot(aGeo.xy,vec2(12.9898,78.233)))*43758.5453);
  gl_PointSize=uPointSize*uPixelRatio*clamp(uRadius/12.0,.08,1.0)*mix(aGeo.w*(.9+vSeed*.2),1.0,uRing);
  vStrength=uRing>.5?1.0:mix(aGeo.z,1.0,uStrengthBoost);
  vShimmer=uRing>.5?1.0:(.82+.18*sin(uTime*(.65+vSeed*.5)+vSeed*6.28318))*(.6+vSeed*.4);
  vFront=view.z;
}`;

export const lineFragmentShader = `#version 300 es
precision highp float;
in float vFront;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 outColor;
void main() {
  if(vFront<0.0) discard;
  outColor=vec4(uColor,uOpacity);
}`;

export const routeVertexShader = `#version 300 es
precision highp float;
in vec4 aGeo;
in vec4 aStyle;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uLongitude;
uniform float uLatitude;
uniform float uPixelRatio;
uniform float uPointSize;
out vec2 vLocal;
out vec2 vDistance;
out float vLength;
out float vFront;
vec3 project(vec2 geo) {
  float lon=radians(geo.x)-uLongitude,lat=radians(geo.y);
  vec3 world=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
  vec3 view=vec3(world.x,cos(uLatitude)*world.y-sin(uLatitude)*world.z,sin(uLatitude)*world.y+cos(uLatitude)*world.z);
  return vec3((view.xy*uRadius+uCenter)*uResolution.y*.5+uResolution*.5,view.z);
}
void main() {
  vec3 a=project(aGeo.xy),b=project(aGeo.zw);
  vec2 delta=b.xy-a.xy;
  vLength=max(length(delta),.001);
  vec2 tangent=length(delta)>.001?delta/vLength:vec2(1.0,0.0);
  float extent=(uPointSize*.5+2.0)*uPixelRatio;
  vLocal=vec2(aStyle.x*vLength+(aStyle.x*2.0-1.0)*extent,aStyle.y*extent);
  vec2 pixel=a.xy+tangent*vLocal.x+vec2(-tangent.y,tangent.x)*vLocal.y;
  gl_Position=vec4(pixel/uResolution*2.0-1.0,0.0,1.0);
  vDistance=aStyle.zw;
  vFront=min(a.z,b.z);
}`;

export const routeFragmentShader = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vDistance;
in float vLength;
in float vFront;
uniform float uPixelRatio;
uniform float uPointSize;
uniform float uTime;
uniform float uRouteLength;
uniform float uFlowEnabled;
uniform float uRing;
uniform float uOpacity;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  if(vFront<0.0) discard;
  float d=length(vec2(vLocal.x-clamp(vLocal.x,0.0,vLength),vLocal.y));
  float halfWidth=uPointSize*.5*uPixelRatio;
  float core=1.0-smoothstep(halfWidth-.6*uPixelRatio,halfWidth+.6*uPixelRatio,d);
  float edge=1.0-smoothstep(halfWidth+.2*uPixelRatio,halfWidth+1.5*uPixelRatio,d);
  float distanceKm=mix(vDistance.x,vDistance.y,clamp(vLocal.x/vLength,0.0,1.0));
  float phase=fract(distanceKm/max(uRouteLength/8.0,.1)-uTime*.36);
  float pulse=(1.0-smoothstep(.04,.22,abs(phase-.5)))*uFlowEnabled;
  vec3 color=uRing>.5?vec3(.06,.018,.012):mix(uColor,vec3(1.0,.98,.83),pulse);
  float alpha=(uRing>.5?edge*.65:core)*uOpacity;
  if(alpha<.005) discard;
  outColor=vec4(color,alpha);
}`;

export const lightFragmentShader = `#version 300 es
precision highp float;
in float vFront;
in float vShimmer;
in float vStrength;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRing;
out vec4 outColor;
void main() {
  if(vFront<0.0) discard;
  float radius=length(gl_PointCoord-vec2(.5));
  float core=1.0-smoothstep(.045,.11,radius);
  float halo=exp(-radius*radius*22.0)*.32;
  float shimmer=vShimmer;
  if(uRing>.5) {
    core=(1.0-smoothstep(.075,.13,radius))+(1.0-smoothstep(.016,.038,abs(radius-.32)));
    halo=exp(-radius*radius*15.0)*.24;
    shimmer=1.0;
  }
  float alpha=clamp(core+halo,0.0,1.0)*uOpacity*shimmer*vStrength;
  if(alpha<.005) discard;
  vec3 color=mix(uColor,vec3(1.0,.91,.62),uRing>.5?.1:core*.65);
  outColor=vec4(color,alpha);
}`;

export const clusterVertexShader = `#version 300 es
precision highp float;
in vec4 aGeo;
in vec4 aStyle;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uLongitude;
uniform float uLatitude;
out vec2 vCorner;
out vec4 vStyle;
out float vFront;
void main() {
  float lon=radians(aGeo.x)-uLongitude,lat=radians(aGeo.y);
  vec3 world=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon));
  vec3 view=vec3(world.x,cos(uLatitude)*world.y-sin(uLatitude)*world.z,sin(uLatitude)*world.y+cos(uLatitude)*world.z);
  float radius=aStyle.x*uRadius;
  vec2 p=view.xy*uRadius+uCenter+aGeo.zw*radius;
  gl_Position=vec4(p.x*uResolution.y/uResolution.x,p.y,0.0,1.0);
  vCorner=aGeo.zw; vStyle=aStyle; vFront=view.z;
}`;

export const clusterFragmentShader = `#version 300 es
precision highp float;
in vec2 vCorner;
in vec4 vStyle;
in float vFront;
uniform float uTime;
uniform float uOpacity;
out vec4 outColor;
void main() {
  if(vFront<0.0) discard;
  float radius=length(vCorner);
  float coverage=exp(-radius*radius*3.5)*(1.0-smoothstep(.8,1.0,radius));
  float wave=.5+.5*cos((uTime-vStyle.w*.17)*3.14159265/3.8);
  float shimmer=.58+.42*wave;
  vec3 color=vec3(.95686,.78824,.47059);
  outColor=vec4(color,coverage*vStyle.y*shimmer*uOpacity);
}`;
