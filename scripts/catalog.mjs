// Catálogo inicial real de La Catalina. Genera supabase/migrations/0004_catalog.sql
// Uso: node scripts/catalog.mjs
import fs from "node:fs";

const categories = [
  ["Medicamentos veterinarios", "syringe", "rose", 1],
  ["Antiparasitarios y mascotas", "paw", "amber", 2],
  ["Insecticidas y raticidas", "bug", "orange", 3],
  ["Herbicidas", "leaf", "lime", 4],
  ["Fertilizantes", "sprout", "emerald", 5],
  ["Equipos y ferretería", "wrench", "sky", 6],
];

// [nombre, presentación, precio | null]
const products = {
  "Medicamentos veterinarios": [
    ["Ganadil Pituit", "100 ml", 300],
    ["Complejo-B Alfa", "25 ml"],
    ["Complejo-B Alfa", "100 ml"],
    ["Hierro-Dextrano Alfa 10%", "25 ml"],
    ["Hierro-Dextrano Alfa 10%", "100 ml"],
    ["Tylo-Combisone", null],
    ["Biomisil 1%", "250 ml"],
    ["Iver + AD3E", null],
    ["Oxitetraciclina 50 mg", "100 ml", 350],
    ["Emivem", "50 ml"],
    ["Aumentha ATP", "100 ml"],
    ["Ivomec-F", "50 ml"],
    ["Dexametasona Alfa", null],
    ["Irondel Plus", null],
    ["Enromax L.A.", null],
    ["Anti-Mastitis A", null],
    ["Anti-Mastitis S", "400/200 mg"],
    ["Lactigan Secado", null, 600],
    ["Revimín", "250 ml", 800],
    ["Revimín", "500 ml", 1400],
    ["Ivermin 1%", "200 ml"],
    ["Ivermin 1%", "50 ml"],
    ["Ivermic + AD3E", "100 ml"],
    ["Ivermic + AD3E", "50 ml"],
    ["Ubrex Blanca", "2 oz"],
    ["Ubrex Blanca", "16 oz"],
    ["Ubrex Rojo", "16 oz"],
    ["Equino Dol Gel", "250 ml"],
    ["Equino Dol Gel", "500 ml"],
    ["Fosforón SE", "100 ml", 950],
    ["Flunixivem 50", "50 ml"],
    ["Ivercur", "Sobre 10 g", 110],
  ],
  "Antiparasitarios y mascotas": [
    ["Vermectin", null, 250],
    ["Pulguita Talco", "100 g", 160],
    ["Fiprocan", null, 325],
    ["Shampoo Dominal", "250 ml", 375],
    ["Blue Action Shampoo Garrapaticida", "16 oz"],
    ["Beni Bio Shampoo Animal", "16 oz", 225],
    ["Beni Bio Shampoo para Caballo", "32 oz"],
    ["Pluma Sana", "480 ml", 385],
    ["Bactrovet Plata AM", "Aerosol", 325],
    ["Dominal Max pipeta perros +40 kg", "Pipeta", 325],
    ["Dominal Max pipeta perros hasta 5 kg", "Pipeta"],
    ["Asuntol Jabón", "Unidad"],
    ["Collar antiparasitario König", "Unidad"],
  ],
  "Insecticidas y raticidas": [
    ["Plagox", "400 ml", 425],
    ["Plagox", "250 ml"],
    ["Beno Aerosol Insecticida", "600 ml", 300],
    ["Jimo Cupim", "400 ml", 290],
    ["Jimo Rat", "Pellets"],
    ["Montro 0.005 RB", null],
    ["Drago 25 EC", "1 L"],
    ["Drago 25 EC", "Pequeño", 250],
    ["Sinodivos 78 EC", "50 ml"],
    ["Bentaking 5.7 WG", "100 g", 260],
    ["Malban 60 WP", null],
    ["Extintox EC", null],
    ["VPlag Desinfectante Insecticida Ambientador", "32 oz", 700],
    ["Creolina Ultra Fuerte", "Galón", 650],
    ["Trampa pegante para ratas", "Unidad"],
  ],
  Herbicidas: [
    ["Rainbow Glufosinato de Amonio 20 SL", "1 L", 350],
    ["Inicio Glufosinato 15 SL", "1 L", 400],
    ["Rayo 35.6 SL", "1 L"],
    ["Roundup 35.6 SL", "1 L"],
    ["Dergax 36 AS", "1 L", 525],
    ["Rifle 72 SL", "1 L"],
    ["Fenosanz 72 SL", "350 ml"],
    ["Quilubrisa Paraquat 20 SL", "1 L", 350],
    ["Quilubrisa Paraquat 20 SL", "5 L", 1400],
    ["Radical 30.4 SL", "1 L"],
    ["Radical 30.4 SL", "5 L", 2150],
  ],
  Fertilizantes: [
    ["Futuro Nutrilon Iniciador", "1 L", 490],
    ["Futuro Nutrilon Crecimiento", "1 L", 490],
    ["Futuro Nutrilon Floración", "1 L"],
    ["Gurafol Desarrollo 30-10-10", null, 280],
    ["Gurafol Producción 10-10-55", "1 kg"],
    ["Gurafol-Plus SL", "1 L", 950],
    ["Bayfolan Forte", null],
  ],
  "Equipos y ferretería": [
    ["Bebedero/comedero para aves", "Unidad", 325],
    ["Biberón para becerros", "Unidad"],
    ["Atomizador", "Unidad", 200],
    ["Cable ties", "Paquete"],
    ["Esfre Bom ralo para pila", "Unidad"],
    ["Pegamento Epoxy 5 minutos Bond", "Unidad"],
    ["Hilo Truper para desbrozadora", "2.4 mm x 12 m"],
    ["Conector hembra Truper", '5/8"-3/4"'],
    ["Pulpos elásticos", "Unidad", 125],
  ],
};

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
let sql = `-- =============================================================
-- Catálogo inicial real (generado por scripts/catalog.mjs)
-- Stock demo: 10 unidades. Costo vacío. Precio 0 = "Sin precio".
-- =============================================================
insert into public.business_settings (id) values (1) on conflict (id) do nothing;

insert into public.categories (name, icon, color, sort) values
${categories.map(([n, i, c, s]) => `  (${q(n)}, ${q(i)}, ${q(c)}, ${s})`).join(",\n")}
on conflict (name) do update set icon = excluded.icon, color = excluded.color, sort = excluded.sort;

insert into public.products (name, presentation, category_id, price, stock, min_stock)
select v.name, v.presentation, c.id, v.price, 10, 3
from (values
`;
const rows = [];
for (const [cat, list] of Object.entries(products)) {
  for (const [name, pres, price] of list) rows.push(`  (${q(name)}, ${q(pres)}, ${q(cat)}, ${price ?? 0})`);
}
sql += rows.join(",\n");
sql += `
) as v(name, presentation, category, price)
join public.categories c on c.name = v.category
where not exists (
  select 1 from public.products p
  where p.name = v.name and coalesce(p.presentation, '') = coalesce(v.presentation, '')
);
`;
fs.writeFileSync("supabase/migrations/0004_catalog.sql", sql);
console.log(`Productos: ${rows.length}`);
