import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
const source = readFileSync('components/profile-feed/ProfileIdentityCard.tsx', 'utf8');
const css = readFileSync('app/profile-feed/compact-profile.module.css', 'utf8');
const page = readFileSync('app/profile-feed/page.tsx', 'utf8');
const ast = postcss.parse(css);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const identityModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === 'next/link') return { default: props => createElement('a', props) };
  if (name === '../AppLogo') return { default: props => createElement('span', { className: props.className }, props.alt) };
  if (name === '../../lib/branding') return {};
  return require(name);
}, identityModule, identityModule.exports);
const render = props => renderToStaticMarkup(createElement(identityModule.exports.default, {
  username: 'VeryLongUsernameThatMustKeepItsEllipsis', firstName: 'Julian', lastName: 'Hernandez',
  genderIdentity: 'male', age: 40, followersCount: 12, fitDesktopPersonalDataRow: true,
  avatarHref: '/settings/personal-data', stabilizeMobileHeight: true, ...props,
}));
const rules = selector => ast.nodes.flatMap(node => node.nodes || []).filter(node => node.type === 'rule' && node.selector.includes(selector));
const declaration = (selector, name) => rules(selector).flatMap(rule => rule.nodes).filter(node => node.prop === name).map(node => node.value).at(-1);

test('all compact overrides are CSS-only, restricted to the own overview at 389px and below', () => {
  const media = ast.nodes.filter(node => node.type === 'atrule');
  const normalRules = ast.nodes.filter(node => node.type === 'rule');
  assert.equal(normalRules.length, 1);
  assert.equal(normalRules[0].selector, '.firstViewport');
  assert.equal(normalRules[0].nodes[0].prop, 'display');
  assert.equal(normalRules[0].nodes[0].value, 'contents');
  assert.equal(media.length, 1); assert.equal(media[0].params, '(max-width: 389px)');
  media[0].walkRules(rule => assert.ok(rule.selector.startsWith('.overview') || ['.page', '.firstViewport'].includes(rule.selector)));
  assert.match(page, /compactProfileStyles.overview/);
  const visited = readFileSync('app/users/[username]/page.tsx', 'utf8');
  assert.doesNotMatch(visited, /compact-profile|compactProfileStyles/);
  assert.doesNotMatch(css, /overflow-y|overflow-x|scroll|ResizeObserver|transition:/);
  assert.match(page, /h-dvh overflow-x-clip overflow-y-hidden/);
});
test('normal avatar, min-height, typography and ellipsis classes remain on the rendered component', () => {
  const html = render();
  assert.match(html, /min-h-\[264px\] xl:min-h-\[220px\]/);
  assert.match(html, /top-24 z-10 block h-20 w-20/);
  assert.match(html, /truncate overflow-hidden text-ellipsis whitespace-nowrap text-2xl/);
  assert.match(html, /truncate overflow-hidden text-ellipsis whitespace-nowrap text-base/);
  assert.match(html, /data-profile-identity-label/);
  assert.match(html, /href="\/settings\/personal-data"/);
});
test('avatar and logo share the top area; label is hidden without hiding username or name', () => {
  assert.equal(declaration('[data-profile-identity-avatar]', 'grid-row'), '1 / span 2');
  assert.equal(declaration('[data-profile-identity-avatar]', 'top'), '0');
  assert.equal(declaration('[data-profile-identity-logo]', 'grid-row'), '1');
  assert.equal(declaration('[data-profile-identity-label]', 'display'), 'none');
  assert.equal(declaration('[data-profile-identity-text]', 'grid-row'), '2');
  assert.equal(declaration('[data-profile-identity-text]', 'white-space'), 'nowrap');
});
test('identity and age occupy distinct first-row cells; followers occupy a separate full row', () => {
  assert.equal(declaration('[data-profile-chip="gender"]', 'grid-column'), '1');
  assert.equal(declaration('[data-profile-chip="age"]', 'grid-column'), '2');
  assert.equal(declaration('[data-profile-chip="followers"]', 'grid-row'), '2');
  assert.equal(declaration('[data-profile-identity-followers]', 'grid-row'), '4');
  assert.equal(declaration('[data-profile-identity-followers]', 'position'), 'static');
  for (const followersCount of [1, 12, 123456]) {
    const withAge = render({ followersCount });
    const withoutAge = render({ followersCount, age: null });
    assert.match(withAge, /data-profile-identity-followers/);
    assert.doesNotMatch(withAge, /data-profile-chip="followers"/);
    assert.match(withoutAge, /data-profile-chip="followers"/);
    assert.doesNotMatch(withoutAge, /data-profile-identity-followers/);
    assert.match(withAge, new RegExp(`Tiene ${followersCount} seguidor`));
  }
});
test('private or absent fields do not introduce extra chips', () => {
  const html = render({ ageVisible: false, genderIdentityVisible: false, followersCount: null });
  assert.doesNotMatch(html, /data-profile-chip=|data-profile-identity-followers/);
});
test('loading and loaded identities share compact selectors and reserved height', () => {
  for (const isLoading of [true, false]) {
    const html = render({ isLoading });
    for (const marker of ['data-profile-identity-header', 'data-profile-identity-avatar', 'data-profile-identity-text', 'data-profile-identity-chips']) assert.ok(html.includes(marker));
  }
  assert.equal(declaration('[data-profile-identity]', 'min-height'), 'clamp(12.125rem, min(calc(45vw + 4rem), calc(50dvh - 8rem)), 15rem)');
});
test('favorites are moved by surrounding spacing; no favorite card geometry or interactions are overridden', () => {
  assert.equal(declaration('[data-tour="profile-favorites"]', 'gap'), 'var(--compact-profile-space)');
  assert.equal(declaration(':global(.favorite-movies-block)', 'padding-block'), '0.5rem');
  assert.doesNotMatch(css, /favorite-movie-card|cube|ratings|dots|quick-navigation/);
});


test('the first compact block reserves a viewport and dock-safe bottom before connections', () => {
  assert.equal(declaration('.firstViewport', 'display'), 'block');
  assert.equal(declaration('.firstViewport', 'box-sizing'), 'border-box');
  assert.equal(declaration('.firstViewport', 'min-height'), '100dvh');
  assert.equal(declaration('.firstViewport', 'background'), '#000');
  assert.equal(declaration('.firstViewport', 'padding-bottom'), 'var(--mobile-profile-nav-clearance, calc(5rem + env(safe-area-inset-bottom, 0px)))');
  const start = page.indexOf('<div className={compactProfileStyles.firstViewport}>');
  const end = page.indexOf('ref={(node) => { userSearchContainerRef.current', start);
  const overview = page.slice(start, end);
  assert.ok(overview.includes('ref={topSectionRef}'));
  assert.ok(overview.includes('<ProfileIdentityCard'));
  assert.ok(overview.includes('<FavoriteMoviesBlock'));
  assert.match(overview, /<\/section>\s*<\/div>\s*<section $/);
});

test('compact spacing grows smoothly with available width while preserving one compact layout', () => {
  assert.equal(declaration('.page', '--compact-profile-space'), 'clamp(0.375rem, min(calc(8vw - 1rem), calc(3dvh - 0.75rem)), 0.875rem)');
  assert.equal(declaration('[data-profile-identity]', 'row-gap'), 'var(--compact-profile-space)');
  assert.equal(declaration('.overview > div', 'gap'), 'var(--compact-profile-space)');
  assert.equal(declaration('[data-profile-identity]', 'padding'), 'clamp(0.375rem, calc(8vw - 1rem), 0.75rem)');
  assert.equal(ast.nodes.filter(node => node.type === 'atrule').length, 1);
});
