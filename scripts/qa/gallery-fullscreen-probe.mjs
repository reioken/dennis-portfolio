import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage();await page.setContent('<button onclick="document.documentElement.requestFullscreen()">Enter</button>');await page.locator('button').click();await page.waitForFunction(()=>!!document.fullscreenElement);console.log('Before Escape',await page.evaluate(()=>!!document.fullscreenElement));await page.keyboard.press('Escape');await page.waitForTimeout(150);console.log('After Escape',await page.evaluate(()=>!!document.fullscreenElement));}finally{await browser.close();}

