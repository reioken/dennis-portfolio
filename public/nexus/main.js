(() => {
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab){for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected}}
for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{let i=tabs.indexOf(tab);if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();selectTab(tabs[i]);tabs[i].focus()})}
const dialog=document.getElementById('lightbox');
let opener;
for(const button of document.querySelectorAll('[data-full]'))button.addEventListener('click',()=>{opener=button;const image=button.querySelector('img');const expanded=dialog.querySelector('img');expanded.src=image.src;expanded.alt=image.alt;dialog.showModal()});
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
dialog.addEventListener('close',()=>opener?.focus());

})();
