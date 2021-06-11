const Koa = require("koa");

const KoaRouter = require("koa-router");

const puppeteer = require("puppeteer");

const app = new Koa();

const router = new KoaRouter();

function setResponseData (ctx, code, message, data) {
  ctx.response.body = {
    message,
    result: data,
    status: code
  }
}

function toParseInt (number) {
  if (typeof number === 'number') {
    return number;
  } else {
    return parseInt(number, 10);
  }
}

router.get("/kfb-node-api/shot-html-to-image", async (ctx) => {
  const {
    path,
    width,
    height,
    deviceScaleFactor,
    userAgent,
    selector,
    isFullPage = false,
    index = 0,
    ignoreSelectors
  } = ctx.query;

  if (!path) {
    setResponseData(ctx, 'W0001', '参数path不能为空', null);
    return
  }

  await puppeteer.launch().then(async browser => {
    try {
      const page = await browser.newPage();

      // 模拟移动端设备
      console.log(toParseInt(height), !selector && isFullPage)
      await page.emulate({
        viewport: {
          width: toParseInt(width),
          height: toParseInt(height),
          deviceScaleFactor: toParseInt(deviceScaleFactor),
          isMobile: true,
          hasTouch: true,
          isLandscape: false
        },
        userAgent: userAgent
      });

      await page.goto(path);

      let element = null;

      if (selector) {
        await page.waitForSelector(selector);
        const elements = await page.$$(selector);
        element = elements[index];
      } else {
        await page.waitForNavigation({
          options: {
            waitUntil: "load",
            timeout: 1000
          }
        });
        // await page.waitFor(3000)
        element = page;
      }

      if (!element) {
        setResponseData(ctx, 'W0002', '无法获取到dom元素', null);
        return
      }

      await page.evaluate(() => {
        const images = document.querySelectorAll('img');

        function preLoadImages () {
          const promises = [];

          function loadImage (img) {
            return new Promise(function (resolve) {
              if (img.complete) {
                resolve(img);
              }
              img.onload = function () {
                resolve(img);
              };
              img.onerror = function () {
                resolve(img);
              };
            })
          }

          for (let i = 0; i < images.length; i++) {
            promises.push(loadImage(images[i]));
          }

          return Promise.all(promises);
        }

        return preLoadImages();
      });

      // 隐藏忽略的元素
      if (ignoreSelectors) {
        let ignoreSelectorsList = [];
        if (typeof ignoreSelectors !== 'string') {
          ignoreSelectorsList = ignoreSelectors.toString().split(',');
        } else {
          ignoreSelectorsList = ignoreSelectors.split(',');
        }
        for (const ignoreSelector of ignoreSelectorsList) {
          await page.$$eval(ignoreSelector, (els) => {
            if (els && els.length) {
              for (const el of els) {
                el && (el.style.display = 'none');
              }
            }
          });
        }
      }

      const base64 = await element.screenshot({ encoding: 'base64', fullPage: !selector && isFullPage });

      await browser.close();

      setResponseData(ctx, 'C0000', 'success', `data:image/png;base64,${base64}`);
    } catch (err) {
      console.log(err)
      setResponseData(ctx, 'W0033', `服务异常:${err}`, null)
    }
  })
})

app.use(router.routes());

app.listen(9527, () => console.log(">>>>> node server start <<<<<"));
