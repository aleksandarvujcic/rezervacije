import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rezervacije:rezervacije_dev@localhost:5432/rezervacije',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Seed users
    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, password_hash, display_name, role)
      VALUES
        ('admin', $1, 'Administrator', 'owner'),
        ('menadzer', $1, 'Menadžer', 'manager'),
        ('konobar1', $1, 'Marko', 'waiter'),
        ('konobar2', $1, 'Jelena', 'waiter')
      ON CONFLICT (username) DO NOTHING
    `, [passwordHash]);

    // Seed working hours (Mon-Sun, 10:00-21:00)
    for (let day = 0; day <= 6; day++) {
      await client.query(`
        INSERT INTO working_hours (day_of_week, open_time, close_time, is_closed)
        VALUES ($1, '10:00', '21:00', false)
        ON CONFLICT (day_of_week) DO NOTHING
      `, [day]);
    }

    // Seed zones
    await client.query(`
      INSERT INTO zones (name, description, sort_order)
      VALUES
        ('Glavna sala', 'Glavna unutrašnja sala', 1),
        ('Bašta', 'Spoljašnja bašta', 2),
        ('VIP', 'VIP sekcija', 3)
      ON CONFLICT DO NOTHING
    `);

    // Get zone IDs
    const zonesResult = await client.query('SELECT id, name FROM zones ORDER BY sort_order');
    const zones = zonesResult.rows;

    // Seed floor plans for each zone
    for (const zone of zones) {
      await client.query(`
        INSERT INTO floor_plans (zone_id, canvas_width, canvas_height)
        VALUES ($1, 1200, 800)
        ON CONFLICT (zone_id) DO NOTHING
      `, [zone.id]);
    }

    // Seed tables for Glavna sala (1-15)
    const glavnaSala = zones.find((z: { name: string }) => z.name === 'Glavna sala');
    if (glavnaSala) {
      const tables = [
        { number: '1', capacity: 2, x: 100, y: 100, w: 60, h: 60 },
        { number: '2', capacity: 2, x: 200, y: 100, w: 60, h: 60 },
        { number: '3', capacity: 4, x: 320, y: 100, w: 80, h: 60 },
        { number: '4', capacity: 4, x: 440, y: 100, w: 80, h: 60 },
        { number: '5', capacity: 4, x: 560, y: 100, w: 80, h: 60 },
        { number: '6', capacity: 6, x: 100, y: 250, w: 100, h: 70 },
        { number: '7', capacity: 6, x: 260, y: 250, w: 100, h: 70 },
        { number: '8', capacity: 8, x: 420, y: 250, w: 120, h: 80 },
        { number: '9', capacity: 4, x: 100, y: 420, w: 80, h: 60 },
        { number: '10', capacity: 4, x: 220, y: 420, w: 80, h: 60 },
        { number: '11', capacity: 2, x: 340, y: 420, w: 60, h: 60 },
        { number: '12', capacity: 2, x: 440, y: 420, w: 60, h: 60 },
        { number: '13', capacity: 8, x: 560, y: 420, w: 120, h: 80 },
        { number: '14', capacity: 4, x: 100, y: 570, w: 80, h: 60 },
        { number: '15', capacity: 6, x: 260, y: 570, w: 100, h: 70 },
      ];
      for (const t of tables) {
        await client.query(`
          INSERT INTO tables (zone_id, table_number, capacity, shape, pos_x, pos_y, width, height)
          VALUES ($1, $2, $3, 'rectangle', $4, $5, $6, $7)
          ON CONFLICT (table_number) DO NOTHING
        `, [glavnaSala.id, t.number, t.capacity, t.x, t.y, t.w, t.h]);
      }
    }

    // Seed tables for Bašta (16-25)
    const basta = zones.find((z: { name: string }) => z.name === 'Bašta');
    if (basta) {
      const tables = [
        { number: '16', capacity: 4, x: 100, y: 100, w: 80, h: 60 },
        { number: '17', capacity: 4, x: 220, y: 100, w: 80, h: 60 },
        { number: '18', capacity: 6, x: 340, y: 100, w: 100, h: 70 },
        { number: '19', capacity: 4, x: 100, y: 250, w: 80, h: 60 },
        { number: '20', capacity: 4, x: 220, y: 250, w: 80, h: 60 },
        { number: '21', capacity: 2, x: 340, y: 250, w: 60, h: 60 },
        { number: '22', capacity: 2, x: 440, y: 250, w: 60, h: 60 },
        { number: '23', capacity: 8, x: 100, y: 400, w: 120, h: 80 },
        { number: '24', capacity: 6, x: 280, y: 400, w: 100, h: 70 },
        { number: '25', capacity: 4, x: 440, y: 400, w: 80, h: 60 },
      ];
      for (const t of tables) {
        await client.query(`
          INSERT INTO tables (zone_id, table_number, capacity, shape, pos_x, pos_y, width, height)
          VALUES ($1, $2, $3, 'rectangle', $4, $5, $6, $7)
          ON CONFLICT (table_number) DO NOTHING
        `, [basta.id, t.number, t.capacity, t.x, t.y, t.w, t.h]);
      }
    }

    // Seed tables for VIP (26-30)
    const vip = zones.find((z: { name: string }) => z.name === 'VIP');
    if (vip) {
      const tables = [
        { number: '26', capacity: 4, x: 150, y: 150, w: 80, h: 60 },
        { number: '27', capacity: 6, x: 300, y: 150, w: 100, h: 70 },
        { number: '28', capacity: 8, x: 150, y: 320, w: 120, h: 80 },
        { number: '29', capacity: 4, x: 350, y: 320, w: 80, h: 60 },
        { number: '30', capacity: 2, x: 500, y: 320, w: 60, h: 60 },
      ];
      for (const t of tables) {
        await client.query(`
          INSERT INTO tables (zone_id, table_number, capacity, shape, pos_x, pos_y, width, height)
          VALUES ($1, $2, $3, 'rectangle', $4, $5, $6, $7)
          ON CONFLICT (table_number) DO NOTHING
        `, [vip.id, t.number, t.capacity, t.x, t.y, t.w, t.h]);
      }
    }

    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
