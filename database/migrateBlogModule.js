const db = require('../server/config/db');

async function migrateBlogModule() {
  console.log('🩺 Starting Healthcare Blog & Medical Articles CMS Database Migration...');

  // 1. Create blog_categories table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(120) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      icon VARCHAR(60) DEFAULT 'fa-notes-medical',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Seed essential healthcare blog categories
  const [catCount] = await db.query('SELECT COUNT(*) as count FROM blog_categories');
  if (catCount[0].count === 0) {
    await db.query(`
      INSERT INTO blog_categories (name, slug, description, icon) VALUES 
      ('Cardiology & Heart Health', 'cardiology-heart-health', 'Preventative cardiovascular care, hypertension management, and heart wellness.', 'fa-heart-pulse'),
      ('Neurology & Brain Health', 'neurology-brain-health', 'Insights into cognitive health, stroke prevention, headache management, and neuroscience.', 'fa-brain'),
      ('Pediatrics & Child Care', 'pediatrics-child-care', 'Childhood development, pediatric immunizations, nutrition, and pediatric wellness.', 'fa-baby'),
      ('Orthopedics & Joint Care', 'orthopedics-joint-care', 'Bone health, athletic injury rehabilitation, joint replacement, and mobility.', 'fa-bone'),
      ('Nutrition & Preventive Health', 'nutrition-preventive-health', 'Evidence-based dietary science, immune support, lifestyle medicine, and longevity.', 'fa-apple-whole'),
      ('Emergency & Critical Care', 'emergency-critical-care', 'First aid responses, recognizing acute trauma signs, and urgent clinical interventions.', 'fa-truck-medical')
    `);
    console.log('✅ Seeded 6 medical blog categories.');
  }

  // 2. Create or Upgrade blog_posts table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      content LONGTEXT NOT NULL,
      author_id INT NULL,
      author_name VARCHAR(150) NOT NULL DEFAULT 'Dr. Marcus Vance, MD',
      category_id INT NULL,
      category_name VARCHAR(100) NOT NULL DEFAULT 'Cardiology & Heart Health',
      tags VARCHAR(255) NULL DEFAULT 'Cardiology, Heart Health, Prevention',
      featured_image VARCHAR(255) NULL DEFAULT '/images/blog-cardio.jpg',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
      seo_title VARCHAR(255) NULL,
      meta_description TEXT NULL,
      views_count INT NOT NULL DEFAULT 0,
      reading_time_minutes INT NOT NULL DEFAULT 5,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_blog_slug (slug),
      INDEX idx_blog_status_pub (status, published_at DESC),
      INDEX idx_blog_category (category_name),
      INDEX idx_blog_featured (is_featured)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Ensure all new columns exist if table was previously created
  const [cols] = await db.query('DESCRIBE blog_posts');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('author_name')) {
    await db.query("ALTER TABLE blog_posts ADD COLUMN author_name VARCHAR(150) NOT NULL DEFAULT 'Dr. Marcus Vance, MD'");
  }
  if (!colNames.includes('category_id')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN category_id INT NULL');
  }
  if (!colNames.includes('category_name')) {
    await db.query("ALTER TABLE blog_posts ADD COLUMN category_name VARCHAR(100) NOT NULL DEFAULT 'Cardiology & Heart Health'");
  }
  if (!colNames.includes('tags')) {
    await db.query("ALTER TABLE blog_posts ADD COLUMN tags VARCHAR(255) NULL DEFAULT 'General Health'");
  }
  if (!colNames.includes('featured_image')) {
    await db.query("ALTER TABLE blog_posts ADD COLUMN featured_image VARCHAR(255) NULL DEFAULT '/images/blog-cardio.jpg'");
  }
  if (!colNames.includes('is_featured')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0');
  }
  if (!colNames.includes('status')) {
    await db.query("ALTER TABLE blog_posts ADD COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published'");
  }
  if (!colNames.includes('seo_title')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN seo_title VARCHAR(255) NULL');
  }
  if (!colNames.includes('meta_description')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN meta_description TEXT NULL');
  }
  if (!colNames.includes('views_count')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN views_count INT NOT NULL DEFAULT 0');
  }
  if (!colNames.includes('reading_time_minutes')) {
    await db.query('ALTER TABLE blog_posts ADD COLUMN reading_time_minutes INT NOT NULL DEFAULT 5');
  }

  // 3. Seed comprehensive clinical articles
  const [postCount] = await db.query('SELECT COUNT(*) as count FROM blog_posts');
  if (postCount[0].count <= 3) {
    // Truncate to re-seed rich medical articles
    await db.query('DELETE FROM blog_posts');

    await db.query(`
      INSERT INTO blog_posts 
      (title, slug, summary, content, author_name, category_name, tags, featured_image, is_featured, status, seo_title, meta_description, views_count, reading_time_minutes, published_at)
      VALUES 
      (
        'Early Detection of Cardiovascular Disease: What Every Adult Should Know',
        'early-detection-cardiovascular-disease',
        'Understanding warning signs, non-invasive biomarker screening, and lifestyle interventions that preserve heart longevity and prevent sudden cardiac arrest.',
        'Cardiovascular disease remains the leading cause of preventable mortality worldwide. Modern cardiology stresses early diagnostic interventions long before acute clinical symptoms emerge.\n\n### Key Clinical Biomarkers\n- **High-Sensitivity C-Reactive Protein (hs-CRP)**: An inflammatory biomarker correlated with arterial plaque instability.\n- **Apolipoprotein B (ApoB)**: Measures the total atherogenic particle burden.\n- **Coronary Calcium Score (CAC)**: A non-invasive computed tomography scan detailing calcified plaque in coronary arteries.\n\n### Preventative Strategies\nAdopting Mediterranean nutritional regimens, 150 minutes of weekly zone-2 aerobic conditioning, and blood pressure monitoring significantly reduces cardiovascular risk profiles.',
        'Dr. Marcus Vance, MD (Chief of Cardiology)',
        'Cardiology & Heart Health',
        'Cardiology, Heart Health, CAC Screening, Preventive Medicine',
        'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80',
        1,
        'published',
        'Early Detection of Cardiovascular Disease: Complete Guide | AuraCare',
        'Learn key clinical biomarkers, CAC scoring, and evidence-based lifestyle protocols for cardiovascular disease prevention.',
        1240,
        6,
        NOW()
      ),
      (
        'Managing Chronic Migraines and Neurological Headaches with Modern Therapies',
        'managing-chronic-migraines-neurological-therapies',
        'A clinical deep dive into CGRP receptor antagonists, neuromodulation devices, and holistic trigger mitigation for severe recurring cephalalgia.',
        'Migraines are complex neurovascular disorders affecting over 1 billion individuals globally. Recent pharmaceutical advances have revolutionized preventative headache medicine.\n\n### The CGRP Pathway Breakthrough\nCalcitonin gene-related peptide (CGRP) plays a central role in trigeminovascular pain transmission. Monoclonal antibodies targeting CGRP have demonstrated substantial reductions in monthly migraine days with minimal adverse effects.\n\n### Neuromodulation and Non-Invasive Therapies\n- **External Trigeminal Nerve Stimulation (e-TNS)**\n- **Non-Invasive Vagus Nerve Stimulation (nVNS)**\n- **Sleep architecture and hydration optimization**',
        'Dr. Elena Rostova, MD (Lead Neurologist)',
        'Neurology & Brain Health',
        'Neurology, Migraine, CGRP Inhibitors, Brain Health',
        'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=800&q=80',
        1,
        'published',
        'Managing Chronic Migraines: Modern Neurology Therapies | AuraCare',
        'Discover CGRP inhibitors, neuromodulation, and clinical headache management with AuraCare neurology specialists.',
        890,
        5,
        DATE_SUB(NOW(), INTERVAL 2 DAY)
      ),
      (
        'Pediatric Immunization Schedules: Evidence-Based Vaccine Safety and Efficacy',
        'pediatric-immunization-schedules-evidence-safety',
        'Clear clinical insights into pediatric vaccination timelines, herd immunity milestones, and pediatric safety standards.',
        'Vaccinations represent one of humanity’s most effective public health achievements. Following recommended childhood immunization schedules shields vulnerable infants against life-threatening infectious pathogens.\n\n### Critical Milestones\n1. **Birth to 2 Months**: Hepatitis B, Rotavirus, DTaP, Hib, Pneumococcal conjugate.\n2. **6 to 12 Months**: Annual Influenza, MMR (Measles, Mumps, Rubella), Varicella.\n3. **Early Childhood (4-6 Years)**: DTaP booster, IPV, MMRV.\n\nConsult your pediatrician to review individualized immunization tracking records.',
        'Dr. Sarah Jenkins, MD (Pediatric Specialist)',
        'Pediatrics & Child Care',
        'Pediatrics, Vaccines, Child Health, Immunization',
        'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
        0,
        'published',
        'Pediatric Immunization Schedules and Safety | AuraCare Clinic',
        'Evidence-based overview of childhood vaccination timelines and infant healthcare milestones.',
        640,
        4,
        DATE_SUB(NOW(), INTERVAL 4 DAY)
      ),
      (
        'Nutritional Biochemistry: Optimizing Metabolic Flexibility and Insulin Sensitivity',
        'nutritional-biochemistry-metabolic-flexibility',
        'How macronutrient composition, continuous glucose monitoring, and intermittent fasting influence cellular mitochondrial health.',
        'Metabolic dysfunction underpins numerous chronic ailments including Type 2 Diabetes and non-alcoholic fatty liver disease. Enhancing insulin sensitivity is paramount.\n\n### Fundamentals of Metabolic Flexibility\n- **Glycemic Load Management**: Replacing refined carbohydrates with complex prebiotic fibers.\n- **Resistance Training**: Enhances GLUT4 translocation independently of insulin signaling.\n- **Micronutrient Cofactors**: Magnesium, Chromium, and Alpha-Lipoic Acid.',
        'Dr. Julian Sterling, MD (Internal Medicine & Nutrition)',
        'Nutrition & Preventive Health',
        'Nutrition, Metabolic Health, Insulin Sensitivity, Longevity',
        'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
        1,
        'published',
        'Nutritional Biochemistry and Metabolic Flexibility | AuraCare',
        'Explore insulin sensitivity, glycemic regulation, and cellular longevity through nutritional medicine.',
        1120,
        7,
        DATE_SUB(NOW(), INTERVAL 6 DAY)
      ),
      (
        'Recognizing Acute Stroke Symptoms: The BE-FAST Clinical Protocol',
        'recognizing-acute-stroke-symptoms-befast-protocol',
        'Time is brain tissue. Learn how rapid recognition of ischemic and hemorrhagic stroke signs saves lives and preserves neurological function.',
        'During an ischemic cerebral infarction, approximately 1.9 million neurons perish every minute. Rapid identification using the BE-FAST protocol is vital.\n\n### The BE-FAST Acronym\n- **B (Balance)**: Sudden loss of coordination or dizziness.\n- **E (Eyes)**: Acute visual disturbance or diplopia.\n- **F (Face)**: Facial asymmetry or unilateral drooping.\n- **A (Arms)**: Unilateral weakness or sensory numbness.\n- **S (Speech)**: Slurred speech or expressive dysphasia.\n- **T (Time)**: Call Emergency Medical Services immediately.',
        'Dr. Elena Rostova, MD (Lead Neurologist)',
        'Emergency & Critical Care',
        'Emergency, Stroke, BE-FAST, Critical Care, Neurology',
        'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80',
        0,
        'published',
        'BE-FAST Protocol for Acute Stroke Recognition | AuraCare Emergency',
        'Learn the critical signs of stroke and why rapid emergency response is essential for neurological recovery.',
        980,
        4,
        DATE_SUB(NOW(), INTERVAL 8 DAY)
      ),
      (
        'Orthopedic Advances in Minimally Invasive Joint Arthroscopy',
        'orthopedic-advances-minimally-invasive-arthroscopy',
        'Understanding arthroscopic meniscus repairs, ACL reconstructions, and accelerated outpatient rehabilitation protocols.',
        'Minimally invasive arthroscopic surgery allows orthopedic surgeons to inspect, diagnose, and repair joint pathologies through millimeter-scale portal incisions.\n\n### Benefits Over Open Arthrotomy\n- Substantially diminished postoperative pain.\n- Preservation of healthy surrounding periarticular soft tissue.\n- Rapid return to athletic competition and daily vocational tasks.',
        'Dr. Robert Chen, MD (Orthopedic Surgeon)',
        'Orthopedics & Joint Care',
        'Orthopedics, Arthroscopy, Joint Surgery, Sports Medicine',
        'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
        0,
        'published',
        'Minimally Invasive Joint Arthroscopy | AuraCare Orthopedics',
        'Explore modern arthroscopic techniques for knee and shoulder joint restoration.',
        750,
        5,
        DATE_SUB(NOW(), INTERVAL 10 DAY)
      )
    `);
    console.log('✅ Seeded 6 comprehensive clinical articles with SEO metadata.');
  }

  console.log('🎉 Healthcare Blog & CMS Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateBlogModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateBlogModule;
