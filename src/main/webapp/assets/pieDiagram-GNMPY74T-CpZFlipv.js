import{p as rt}from"./chunk-JWPE2WC7-YLOFVHPz.js";import{Y as b,a0 as B,bb as nt,g as it,s as ot,a as st,b as lt,x as ct,v as pt,_ as g,l as G,c as ut,P as gt,S as dt,ab as ht,d as ft,B as mt,Q as vt}from"./mermaid.core-dWZCX6Un.js";import{p as xt}from"./cynefin-EF2NZ3EQ-CFlVfale.js";import{d as Z}from"./arc-CoQEhDT9.js";import{o as St}from"./ordinal-Cboi1Yqb.js";import"./index-DRnST_R6.js";import"./vendor-react-HlBdVrsM.js";import"./ProjectDocumentsPage-DnLjmlc_.js";import"./apiErrors-4lZy6WkK.js";import"./ProjectLayout-Dvr3fvmM.js";import"./tabParts-DVJ-l7Fq.js";import"./format-JFlP-sxx.js";import"./docUi-BOEElD3z.js";import"./Modal-BUqB6uTe.js";import"./SelectField-WNQofuoT.js";import"./listControls-BlSMhbvG.js";import"./vendor-editor-CLUwbVBX.js";import"./Switch-DF78gIFN.js";import"./MentionInput-Dlgjss9k.js";import"./Toast-d3h8SmgA.js";import"./TextAreaField-B8OJtD6e.js";import"./AiLayoutProposalDrawer-BunZZz3g.js";import"./NewDocButton-Cg_udEIr.js";import"./init-Gi6I4Gst.js";function yt(t,n){return n<t?-1:n>t?1:n>=t?0:NaN}function wt(t){return t}function At(){var t=wt,n=yt,y=null,T=b(0),l=b(B),d=b(0);function i(e){var r,s=(e=nt(e)).length,h,w,$=0,f=new Array(s),o=new Array(s),D=+T.apply(this,arguments),E=Math.min(B,Math.max(-B,l.apply(this,arguments)-D)),k,L=Math.min(Math.abs(E)/s,d.apply(this,arguments)),p=L*(E<0?-1:1),A;for(r=0;r<s;++r)(A=o[f[r]=r]=+t(e[r],r,e))>0&&($+=A);for(n!=null?f.sort(function(M,m){return n(o[M],o[m])}):y!=null&&f.sort(function(M,m){return y(e[M],e[m])}),r=0,w=$?(E-s*p)/$:0;r<s;++r,D=k)h=f[r],A=o[h],k=D+(A>0?A*w:0)+p,o[h]={data:e[h],index:r,value:A,startAngle:D,endAngle:k,padAngle:L};return o}return i.value=function(e){return arguments.length?(t=typeof e=="function"?e:b(+e),i):t},i.sortValues=function(e){return arguments.length?(n=e,y=null,i):n},i.sort=function(e){return arguments.length?(y=e,n=null,i):y},i.startAngle=function(e){return arguments.length?(T=typeof e=="function"?e:b(+e),i):T},i.endAngle=function(e){return arguments.length?(l=typeof e=="function"?e:b(+e),i):l},i.padAngle=function(e){return arguments.length?(d=typeof e=="function"?e:b(+e),i):d},i}var Ct=vt.pie,I={sections:new Map,showData:!1},_=I.sections,V=I.showData,$t=structuredClone(Ct),Dt=g(()=>structuredClone($t),"getConfig"),bt=g(()=>{_=new Map,V=I.showData,mt()},"clear"),Tt=g(({label:t,value:n})=>{if(n<0)throw new Error(`"${t}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);_.has(t)||(_.set(t,n),G.debug(`added new section: ${t}, with value: ${n}`))},"addSection"),kt=g(()=>_,"getSections"),zt=g(t=>{V=t},"setShowData"),Et=g(()=>V,"getShowData"),q={getConfig:Dt,clear:bt,setDiagramTitle:pt,getDiagramTitle:ct,setAccTitle:lt,getAccTitle:st,setAccDescription:ot,getAccDescription:it,addSection:Tt,getSections:kt,setShowData:zt,getShowData:Et},Mt=g((t,n)=>{rt(t,n),n.setShowData(t.showData),t.sections.map(n.addSection)},"populateDb"),Rt={parse:g(async t=>{const n=await xt("pie",t);G.debug(n),Mt(n,q)},"parse")},Lt=g(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),Pt=Lt,Wt=g(t=>{const n=[...t.values()].reduce((l,d)=>l+d,0),y=[...t.entries()].map(([l,d])=>({label:l,value:d})).filter(l=>l.value/n*100>=1);return At().value(l=>l.value).sort(null)(y)},"createPieArcs"),_t=g((t,n,y,T)=>{var Y;G.debug(`rendering pie chart
`+t);const l=T.db,d=ut(),i=gt(l.getConfig(),d.pie),e=40,r=18,s=4,h=450,w=h,$=dt(n),f=$.append("g");f.attr("transform","translate("+w/2+","+h/2+")");const{themeVariables:o}=d;let[D]=ht(o.pieOuterStrokeWidth);D??(D=2);const E=i.legendPosition,k=i.textPosition,L=i.donutHole>0&&i.donutHole<=.9?i.donutHole:0,p=Math.min(w,h)/2-e,A=Z().innerRadius(L*p).outerRadius(p),M=Z().innerRadius(p*k).outerRadius(p*k),m=f.append("g");m.append("circle").attr("cx",0).attr("cy",0).attr("r",p+D/2).attr("class","pieOuterCircle");const P=l.getSections(),J=Wt(P),K=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12];let F=0;P.forEach(a=>{F+=a});const U=J.filter(a=>(a.data.value/F*100).toFixed(0)!=="0"),H=St(K).domain([...P.keys()]);m.selectAll("mySlices").data(U).enter().append("path").attr("d",A).attr("fill",a=>H(a.data.label)).attr("class",a=>{let c="pieCircle";return i.highlightSlice==="hover"?c+=" highlightedOnHover":i.highlightSlice===a.data.label&&(c+=" highlighted"),c}),m.selectAll("mySlices").data(U).enter().append("text").text(a=>(a.data.value/F*100).toFixed(0)+"%").attr("transform",a=>"translate("+M.centroid(a)+")").style("text-anchor","middle").attr("class","slice");const tt=f.append("text").text(l.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),R=[...P.entries()].map(([a,c])=>({label:a,value:c})),C=f.selectAll(".legend").data(R).enter().append("g").attr("class","legend");C.append("rect").attr("width",r).attr("height",r).style("fill",a=>H(a.label)).style("stroke",a=>H(a.label)),C.append("text").attr("x",r+s).attr("y",r-s).text(a=>l.getShowData()?`${a.label} [${a.value}]`:a.label);const z=Math.max(...C.selectAll("text").nodes().map(a=>(a==null?void 0:a.getBoundingClientRect().width)??0));let W=h,N=w+e;const u=r+s,O=R.length*u;switch(E){case"center":C.attr("transform",(a,c)=>{const v=u*R.length/2,x=-z/2-(r+s),S=c*u-v;return"translate("+x+","+S+")"});break;case"top":W+=O,C.attr("transform",(a,c)=>{const v=p,x=-z/2-(r+s),S=c*u-v;return`translate(${x}, ${S})`}),m.attr("transform",()=>`translate(0, ${O+u})`);break;case"bottom":W+=O,C.attr("transform",(a,c)=>{const v=-p-u,x=-z/2-(r+s),S=c*u-v;return"translate("+x+","+S+")"});break;case"left":N+=r+s+z,C.attr("transform",(a,c)=>{const v=u*R.length/2,x=-p-(r+s),S=c*u-v;return"translate("+x+","+S+")"}),m.attr("transform",()=>`translate(${z+r+s}, 0)`);break;case"right":default:N+=r+s+z,C.attr("transform",(a,c)=>{const v=u*R.length/2,x=12*r,S=c*u-v;return"translate("+x+","+S+")"});break}const j=((Y=tt.node())==null?void 0:Y.getBoundingClientRect().width)??0,et=w/2-j/2,at=w/2+j/2,Q=Math.min(0,et),X=Math.max(N,at)-Q;$.attr("viewBox",`${Q} 0 ${X} ${W}`),ft($,W,X,i.useMaxWidth)},"draw"),Ft={draw:_t},ce={parser:Rt,db:q,renderer:Ft,styles:Pt};export{ce as diagram};
