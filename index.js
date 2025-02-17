const express = require('express');

let chrome = {}; // Inicialización de chrome como objeto vacío
let puppeteer;

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  chrome = require('chrome-aws-lambda');
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('API de scraping de partidos de fútbol');
});

app.get('/api/matches', async (req, res) => {
  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: [...chrome.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  let browser;
  try {
    browser = await puppeteer.launch(options);

    const page = await browser.newPage();
    await page.goto('https://www.promiedos.com.ar/', { timeout: 60000 });

    await page.waitForSelector('.match-info_itemevent__jJv13', { timeout: 60000 });

    const matches = await page.$$eval('.match-info_itemevent__jJv13', (elements) => {
      return elements.map((el) => {
        const leagueElement = el.querySelector('.event-header_left__q8kgh');
        const league = leagueElement ? leagueElement.innerText : '';

        const matchDetails = Array.from(el.querySelectorAll('.item_item__BqOgz')).map((match) => {
          const timeElement = match.querySelector('.time_time__GlBIn');
          const matchStatus = match.querySelector('.time_status___8fRm');
          const time = timeElement ? timeElement.innerText : matchStatus ? matchStatus.innerText : '';

          const homeTeamElement = match.querySelector('.team_left__S_a4n .comand-name__title');
          const homeTeam = homeTeamElement ? homeTeamElement.innerText : '';
          const homeGoalsElement = match.querySelector('.parent_span__TxfTF > div > div:nth-child(1) > span');
          const homeGoals = homeGoalsElement ? homeGoalsElement.innerText : '';

          const awayTeamElement = match.querySelector('.team_right__ePX7C .comand-name__title');
          const awayTeam = awayTeamElement ? awayTeamElement.innerText : '';
          const awayGoalsElement = match.querySelector('.parent_span__TxfTF > div > div:nth-child(3) > span');
          const awayGoals = awayGoalsElement ? awayGoalsElement.innerText : '';

          return { time, homeTeam, awayTeam, homeGoals, awayGoals };
        });

        return { league, matchDetails };
      });
    });

    res.json(matches);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al scrapear la web' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
