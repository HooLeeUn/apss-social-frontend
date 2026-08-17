import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const signup = readFileSync(new URL("../app/signup/page.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("../components/auth/PasswordVisibilityButton.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/auth-translations.ts", import.meta.url), "utf8");

test("login password visibility starts hidden and toggles without changing its value state", () => {
  assert.match(login, /const \[showPassword, setShowPassword\] = useState\(false\)/);
  assert.match(login, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(login, /value=\{password\}/);
  assert.match(login, /onToggle=\{\(\) => setShowPassword\(\(visible\) => !visible\)\}/);
});

test("signup password controls use independent hidden-by-default state", () => {
  assert.match(signup, /const \[showPassword, setShowPassword\] = useState\(false\)/);
  assert.match(signup, /const \[showConfirmPassword, setShowConfirmPassword\] = useState\(false\)/);
  assert.match(signup, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(signup, /type=\{showConfirmPassword \? "text" : "password"\}/);
  assert.match(signup, /setShowPassword\(\(visible\) => !visible\)/);
  assert.match(signup, /setShowConfirmPassword\(\(visible\) => !visible\)/);
});

test("visibility control is accessible, preserves pointer focus, and uses localized labels", () => {
  assert.match(control, /type="button"/);
  assert.match(control, /aria-label=\{visible \? hideLabel : showLabel\}/);
  assert.match(control, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(control, /\{visible \? <path d="m4 4 16 16" \/> : null\}/);
  assert.match(translations, /showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña"/);
  assert.match(translations, /showPassword: "Show password", hidePassword: "Hide password"/);
});
