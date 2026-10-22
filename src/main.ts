import './styles/tokens.css';
import './styles/app.css';
import { App } from './ui/app';
import { reportHeightToParent } from './ui/embed';
import { detectLang } from './ui/i18n';

const params = new URLSearchParams(location.search);
const embed = params.get('embed') === '1';
if (embed) document.documentElement.classList.add('embed');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

new App({
  lang: detectLang(params, navigator.language),
  embed,
  reducedMotion,
  startLevel: params.get('level') ?? undefined,
}).start();

if (embed) reportHeightToParent();
