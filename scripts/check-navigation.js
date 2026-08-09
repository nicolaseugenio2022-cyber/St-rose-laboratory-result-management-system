const fs = require('fs');
const path = require('path');

const navFile = path.join(__dirname, '..', 'src', 'config', 'navigation.ts');
let src = fs.readFileSync(navFile,'utf8');
// Strip import lines
src = src.split('\n').filter(line => !line.trim().startsWith('import')).join('\n');
// Remove exported TypeScript interfaces or exports
src = src.split('\n').filter(line => !line.trim().startsWith('export interface') && !line.trim().startsWith('export type')).join('\n');
// Replace export const with const
src = src.replace(/export const navigationConfig[\s\S]*?=\s*/, 'const navigationConfig = ');
// Remove TS type annotations (very naive) - replace : NavItemConfig[]
src = src.replace(/: ?[A-Za-z0-9_<>\[\]| \'\"]+/g,'');
// Execute in a VM
const vm = require('vm');
const context = { console };
vm.createContext(context);
try {
  // Extract the array literal assigned to navigationConfig
  const file = src;
  const arrayMatch = file.match(/\[([\s\S]*)\]/m);
  if (!arrayMatch) throw new Error('nav array not found');
  const arrayContent = arrayMatch[1];
  // Split top-level items by '},' that are followed by newline and optional spaces
  const rawItems = arrayContent.split(/},\s*\n/);
  const items = rawItems.map(raw => {
    const titleMatch = raw.match(/title:\s*"([^"]+)"/);
    const reqMatch = raw.match(/requiredRole:\s*(\[[^\]]+\]|"[^"]+")/);
    const title = titleMatch ? titleMatch[1] : null;
    let requiredRole = null;
    if (reqMatch) {
      const text = reqMatch[1].trim();
      if (text.startsWith('[')) {
        const roles = text.replace(/\[|\]|\s|\'/g, '').split(',').map(s => s.replace(/"/g,'').trim()).filter(Boolean);
        requiredRole = roles;
      } else {
        requiredRole = text.replace(/"/g, '').trim();
      }
    }
    return { title, requiredRole };
  }).filter(Boolean);
  const navigationConfig = items.filter(i => i.title).map(i => ({ title: i.title, requiredRole: i.requiredRole }));
  const roles = ['Admin','Developer','User', undefined];
  roles.forEach(role => {
    const permitted = navigationConfig.filter(item => {
      if (!item.requiredRole) return true;
      const allowedRoles = Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole];
      return role ? allowedRoles.includes(role) : false;
    }).map(i=>i.title);
    console.log('Role:', role, '=>', permitted);
  });
} catch (err) {
  console.error('Error evaluating navigationConfig:', err);
}
