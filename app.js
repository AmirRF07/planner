/**
 * سامانه هوشمند برنامه‌ریزی تحصیلات تکمیلی تاریخ ایران (گرایش تاریخ ایران دوره اسلامی)
 * فایل اصلی کنترلر، موتور گاهشماری جلالی، پایگاه داده محلی IndexedDB، موتور زمانبندی قطعی و سرویس Gemini API
 */

/*************************************************************************
 * ۱. موتور گاهشماری هجری شمسی (جلالی) و مدیریت منطقه زمانی Asia/Tehran
 *************************************************************************/
class JalaliDateEngine {
  static PERSIAN_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  static WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  static WEEKDAYS_ORDERED = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  // تبدیل اعداد فارسی و عربی به انگلیسی
  static toEnglishDigits(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  // تبدیل اعداد انگلیسی به فارسی جهت نمایش
  static toPersianDigits(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  // تبدیل میلادی به جلالی
  static gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    let jy = -1595 + (33 * Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
  }

  // تبدیل جلالی به میلادی
  static jalaliToGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return [gy, gm, gd];
  }

  // دریافت تاریخ امروز تهران به فرمت استاندارد جلالی YYYY/MM/DD
  static todayJalali() {
    try {
      const now = new Date();
      const tehranParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(now);
      const gy = parseInt(tehranParts.find(p => p.type === 'year').value, 10);
      const gm = parseInt(tehranParts.find(p => p.type === 'month').value, 10);
      const gd = parseInt(tehranParts.find(p => p.type === 'day').value, 10);
      return this.formatJalali(...this.gregorianToJalali(gy, gm, gd));
    } catch {
      const d = new Date();
      return this.formatJalali(...this.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    }
  }

  static formatJalali(jy, jm, jd) {
    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
  }

  static isValidJalaliString(str) {
    const clean = this.toEnglishDigits(str || '').trim();
    const m = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return false;
    const jy = parseInt(m[1], 10);
    const jm = parseInt(m[2], 10);
    const jd = parseInt(m[3], 10);
    if (jy < 1390 || jy > 1450) return false;
    if (jm < 1 || jm > 12) return false;
    const maxDay = this.getMonthDaysCount(jy, jm);
    if (jd < 1 || jd > maxDay) return false;
    return true;
  }

  static normalizeWeekday(day) {
    if (!day) return '';
    let str = String(day).trim();
    str = str.replace(/سه\s*شنبه/g, 'سه‌شنبه');
    str = str.replace(/سهشنبه/g, 'سه‌شنبه');
    return str;
  }

  static normalizeJalali(str) {
    const clean = this.toEnglishDigits(str || '').trim();
    const m = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return clean;
    return this.formatJalali(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  }

  static jalaliToLocalMiddayDate(jStr) {
    const norm = this.normalizeJalali(jStr);
    const parts = norm.split('/').map(Number);
    if (parts.length !== 3 || isNaN(parts[0])) return new Date();
    const [gy, gm, gd] = this.jalaliToGregorian(parts[0], parts[1], parts[2]);
    return new Date(gy, gm - 1, gd, 12, 0, 0);
  }

  static dateToJalaliString(dateObj) {
    const gy = dateObj.getFullYear();
    const gm = dateObj.getMonth() + 1;
    const gd = dateObj.getDate();
    return this.formatJalali(...this.gregorianToJalali(gy, gm, gd));
  }

  static addDaysJalali(jStr, deltaDays) {
    const d = this.jalaliToLocalMiddayDate(jStr);
    d.setDate(d.getDate() + deltaDays);
    return this.dateToJalaliString(d);
  }

  static diffDaysJalali(jStart, jEnd) {
    const d1 = this.jalaliToLocalMiddayDate(jStart);
    const d2 = this.jalaliToLocalMiddayDate(jEnd);
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  static getWeekdayName(jStr) {
    const d = this.jalaliToLocalMiddayDate(jStr);
    return this.WEEKDAYS_FA[d.getDay()];
  }

  // ۰ برای شنبه تا ۶ برای جمعه
  static getWeekdayIndexPersian(jStr) {
    const d = this.jalaliToLocalMiddayDate(jStr);
    // getDay: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const map = [1, 2, 3, 4, 5, 6, 0];
    return map[d.getDay()];
  }

  static toReadablePersianDate(jStr) {
    if (!this.isValidJalaliString(jStr)) return jStr || 'نامشخص';
    const norm = this.normalizeJalali(jStr);
    const [jy, jm, jd] = norm.split('/').map(Number);
    const weekday = this.getWeekdayName(norm);
    const monthName = this.PERSIAN_MONTHS[jm - 1] || '';
    return `${weekday} ${this.toPersianDigits(jd)} ${monthName} ${this.toPersianDigits(jy)}`;
  }

  static getMonthDaysCount(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    // بررسی سال کبیسه برای اسفند
    const [gy, gm, gd] = this.jalaliToGregorian(jy, 12, 30);
    const [backJy, backJm, backJd] = this.gregorianToJalali(gy, gm, gd);
    return (backJy === jy && backJm === 12 && backJd === 30) ? 30 : 29;
  }
}

/*************************************************************************
 * ۲. لایه ذخیره‌سازی محلی در IndexedDB (بدون ارسال داده به ابر)
 *************************************************************************/
class LocalAcademicDB {
  constructor() {
    this.dbName = 'AcademicHistoryPlannerDB';
    this.dbVersion = 2;
    this.db = null;
    this.stores = [
      'semesters',
      'courses',
      'resources',
      'tasks',
      'assessments',
      'mastery',
      'chat_history',
      'forest'
    ];
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        this.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  touch() {
    if (!this.suppressTouch) {
      localStorage.setItem('planner_last_local_update', String(Date.now()));
    }
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => {
        this.touch();
        resolve(item);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => {
        this.touch();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => {
        this.touch();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAllStores() {
    for (const s of this.stores) {
      await this.clearStore(s);
    }
  }
}

/*************************************************************************
 * ۳. موتور زمانبندی قطعی (Deterministic Study Scheduling Engine)
 *************************************************************************/
class DeterministicScheduler {
  static calculateAssignedPages(rangeStr, fallbackTotalPages = 0) {
    const pages = this.getAssignedPageNumbers(rangeStr, fallbackTotalPages);
    return pages.length > 0 ? pages.length : (Number(fallbackTotalPages) || 0);
  }

  static getAssignedPageNumbers(rangeStr, fallbackTotalPages = 0) {
    const clean = JalaliDateEngine.toEnglishDigits(rangeStr || '').trim();
    const pages = [];
    if (!clean || clean === 'نامشخص' || clean === 'ندارد') {
      const total = Number(fallbackTotalPages) || 0;
      for (let p = 1; p <= total; p++) pages.push(p);
      return pages;
    }

    const segments = clean.split(/[،,;]+/);
    for (const seg of segments) {
      const m = seg.trim().match(/^(\d+)\s*[\-–]\s*(\d+)$/);
      if (m) {
        const start = parseInt(m[1], 10);
        const end = parseInt(m[2], 10);
        if (end >= start) {
          for (let p = start; p <= end; p++) pages.push(p);
        }
      } else if (/^\d+$/.test(seg.trim())) {
        pages.push(parseInt(seg.trim(), 10));
      }
    }

    if (pages.length === 0 && fallbackTotalPages > 0) {
      for (let p = 1; p <= fallbackTotalPages; p++) pages.push(p);
    }
    return pages;
  }

  static isTimeOverlapping(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return false;
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    return toMin(startA) < toMin(endB) && toMin(startB) < toMin(endA);
  }

  static generatePlan({ courses, resources, existingTasks, masteryList, preferences, startDateJalali, horizonDays = 21 }) {
    const warnings = [];
    const conflicts = [];
    const generatedTasks = [];

    // حفظ کلیه وظایف انجام‌شده یا در حال انجام قطعی
    const completedTasks = existingTasks.filter(t => t.status === 'completed');

    // محاسبه ضریب تطبیقی سرعت واقعی دانشجو (Pace Adjustment Factor)
    let totalPlannedHist = 0;
    let totalActualHist = 0;
    completedTasks.forEach(t => {
      if (t.actualDurationMinutes > 0 && t.durationMinutes > 0) {
        totalPlannedHist += Number(t.durationMinutes);
        totalActualHist += Number(t.actualDurationMinutes);
      }
    });
    const paceAdjustmentFactor = (totalPlannedHist >= 120)
      ? Math.min(1.5, Math.max(0.75, totalActualHist / totalPlannedHist))
      : 1.0;

    const workUnits = [];
    let totalRequiredHoursAllCourses = 0;

    courses.forEach(course => {
      const courseResources = resources.filter(r => r.courseId === course.id);
      const isExamDateSet = course.examDate && course.examDate !== 'نامشخص' && JalaliDateEngine.isValidJalaliString(course.examDate);
      const daysToExam = isExamDateSet
        ? Math.max(1, JalaliDateEngine.diffDaysJalali(startDateJalali, course.examDate))
        : 75; // افق پیش‌فرض ۷۵ روزه برای دروسی که تاریخ امتحان آنها نامشخص یا در انتهای ترم است

      const urgencyScore = isExamDateSet ? Math.max(10, Math.min(100, Math.round(600 / daysToExam))) : 30;
      const masteryGap = 100 - (Number(course.initialMastery) || 20);
      const difficultyWeight = (Number(course.difficulty) || 3) * 12;
      const basePriority = urgencyScore + (masteryGap * 0.5) + difficultyWeight + ((Number(course.units) || 2) * 8);

      if (courseResources.length > 0) {
        courseResources.forEach(res => {
          const allPageNumbers = this.getAssignedPageNumbers(res.assignedRanges, res.totalPages);
          const totalAssigned = allPageNumbers.length > 0 ? allPageNumbers.length : this.calculateAssignedPages(res.assignedRanges, res.totalPages);
          const completedPages = Number(res.completedPages) || 0;
          const unreadPages = allPageNumbers.length > 0 ? allPageNumbers.slice(completedPages) : [];
          const remainingPages = allPageNumbers.length > 0 ? unreadPages.length : Math.max(0, totalAssigned - completedPages);
          const sessionMinutes = Number(preferences.sessionDurationMinutes) || 75;

          if (remainingPages > 0) {
            const speed = Math.max(3, Number(res.readingSpeedPagesPerHour) || 15);
            const pagesPerSession = Math.max(4, Math.round((speed * (sessionMinutes / 60)) / paceAdjustmentFactor));
            const numReadingSessions = Math.ceil(remainingPages / pagesPerSession);

            for (let i = 0; i < numReadingSessions; i++) {
              let chunkPages = pagesPerSession;
              let startPageNum, endPageNum, rangeDesc;

              if (unreadPages.length > 0) {
                const slice = unreadPages.slice(i * pagesPerSession, (i + 1) * pagesPerSession);
                chunkPages = slice.length;
                startPageNum = slice[0];
                endPageNum = slice[slice.length - 1];
                rangeDesc = (startPageNum === endPageNum)
                  ? `صفحه ${JalaliDateEngine.toPersianDigits(startPageNum)}`
                  : `صفحات ${JalaliDateEngine.toPersianDigits(startPageNum)} تا ${JalaliDateEngine.toPersianDigits(endPageNum)}`;
              } else {
                startPageNum = completedPages + (i * pagesPerSession) + 1;
                endPageNum = Math.min(totalAssigned, startPageNum + pagesPerSession - 1);
                chunkPages = endPageNum - startPageNum + 1;
                rangeDesc = `صفحات ${JalaliDateEngine.toPersianDigits(startPageNum)} تا ${JalaliDateEngine.toPersianDigits(endPageNum)}`;
              }

              let activityType = 'initial_reading';
              let objectiveText = `مطالعه دقیق و استخراج نکات کلیدی ${rangeDesc}`;

              if (res.type === 'primary_source' || course.examFormat === 'historiographical') {
                activityType = (i % 2 === 0) ? 'initial_reading' : 'source_criticism';
                if (activityType === 'source_criticism') {
                  objectiveText = `نقد منبع، بررسی خاستگاه گزارش و مقایسه روایت در ${rangeDesc}`;
                }
              } else if (i % 3 === 1) {
                activityType = 'analytical_notes';
                objectiveText = `فیش‌برداری تحلیلی علل، وقایع و پیامدها (${rangeDesc})`;
              } else if (i % 3 === 2 && (course.examFormat === 'factual_chronological' || course.examFormat === 'essay_analytical')) {
                activityType = 'chronology';
                objectiveText = `بازسازی جدول گاهشمار، سلسله‌ها و نهادهای سیاسی (${rangeDesc})`;
              }

              workUnits.push({
                courseId: course.id,
                courseName: course.name,
                resourceId: res.id,
                resourceTitle: res.title,
                title: `${course.name} — ${res.title} (${rangeDesc})`,
                rangeOrTopic: rangeDesc,
                pagesCount: chunkPages,
                durationMinutes: sessionMinutes,
                objective: objectiveText,
                activityType,
                priorityScore: basePriority + (res.isRequired === 'required' ? 25 : 0) - (i * 0.5),
                deadlineJalali: isExamDateSet ? course.examDate : null
              });

              totalRequiredHoursAllCourses += (sessionMinutes / 60);
            }
          } else {
            // اگر صفحات منبع هنوز توسط استاد مشخص نشده، جلسات مطالعه پایه‌ای سرفصل‌ها زمانبندی می‌شود
            const defaultBookSessions = 3;
            for (let i = 0; i < defaultBookSessions; i++) {
              workUnits.push({
                courseId: course.id,
                courseName: course.name,
                resourceId: res.id,
                resourceTitle: res.title,
                title: `${course.name} — ${res.title} (سرفصل‌های اولیه - صفحات نامشخص)`,
                rangeOrTopic: 'سرفصل‌های کلی (در انتظار اعلام صفحات دقیق)',
                pagesCount: 0,
                durationMinutes: sessionMinutes,
                objective: 'مطالعه مقدماتی و یادداشت‌برداری سرفصل‌های کلیدی تا زمان اعلام صفحات دقیق توسط استاد',
                activityType: (i === 1 && res.type === 'primary_source') ? 'source_criticism' : 'initial_reading',
                priorityScore: basePriority + 10 - i,
                deadlineJalali: isExamDateSet ? course.examDate : null
              });
              totalRequiredHoursAllCourses += (sessionMinutes / 60);
            }
          }
        });
      } else {
        const defaultSessions = Math.max(2, Number(course.units || 2) * 2);
        const sessionMinutes = Number(preferences.sessionDurationMinutes) || 75;
        for (let i = 0; i < defaultSessions; i++) {
          const isEssay = course.examFormat === 'essay_analytical' || course.examFormat === 'mixed';
          workUnits.push({
            courseId: course.id,
            courseName: course.name,
            resourceId: '',
            resourceTitle: 'سرفصل درس (منبع نامشخص)',
            title: `${course.name} — ${isEssay ? 'تمرین نگارش استدلالی و سازماندهی شواهد تاریخی' : 'مرور تحلیلی مباحث کلاسی'} (جلسه ${JalaliDateEngine.toPersianDigits(i + 1)})`,
            rangeOrTopic: `مبحث جلسه ${i + 1}`,
            pagesCount: 0,
            durationMinutes: sessionMinutes,
            objective: isEssay
              ? 'طراحی اسکلت استدلال، دسته‌بندی علل سیاسی-اقتصادی و نگارش پاسخ کامل تحت محدودیت زمان'
              : 'مرور یادداشت‌های کلاسی و بازیابی فعال مفاهیم تا زمان معرفی دقیق منبع',
            activityType: isEssay ? 'essay_practice' : 'spaced_review',
            priorityScore: basePriority - i,
            deadlineJalali: isExamDateSet ? course.examDate : null
          });
          totalRequiredHoursAllCourses += (sessionMinutes / 60);
        }
      }

      // افزودن جلسه مرور با فاصله برای مباحث ضعیف ثبت‌شده
      const weakTopics = masteryList.filter(m => m.courseId === course.id && m.masteryLevel < 75);
      weakTopics.forEach(wt => {
        workUnits.push({
          courseId: course.id,
          courseName: course.name,
          resourceId: '',
          resourceTitle: wt.topic,
          title: `مرور جبرانی و رفع اشکال: ${wt.topic} (${course.name})`,
          rangeOrTopic: wt.topic,
          pagesCount: 0,
          durationMinutes: 60,
          objective: `رفع ضعف شناسایی‌شده (تسلط فعلی: ${JalaliDateEngine.toPersianDigits(wt.masteryLevel)}٪) و تمرین بازیابی فعال`,
          activityType: 'spaced_review',
          priorityScore: basePriority + 35,
          deadlineJalali: isExamDateSet ? course.examDate : null
        });
        totalRequiredHoursAllCourses += 1;
      });

      // افزودن جلسه جمع‌بندی نهایی پیش از امتحان فقط در صورتی که تاریخ امتحان قطعی و نزدیک باشد
      if (isExamDateSet && daysToExam <= horizonDays + 5) {
        workUnits.push({
          courseId: course.id,
          courseName: course.name,
          resourceId: '',
          resourceTitle: 'جمع‌بندی جامع امتحان',
          title: `شبیه‌سازی امتحان زمان‌دار و جمع‌بندی نهایی: ${course.name}`,
          rangeOrTopic: 'کل مباحث امتحانی',
          pagesCount: 0,
          durationMinutes: 90,
          objective: 'پاسخگویی زمان‌دار به سوالات تحلیلی/تشریحی برای تثبیت نمره هدف ۱۸ تا ۲۰',
          activityType: 'final_revision',
          priorityScore: basePriority + 40,
          deadlineJalali: course.examDate
        });
        totalRequiredHoursAllCourses += 1.5;
      }

      // ۴. زمان‌بندی خودکار مراحل مقاله و پژوهش کلاسی
      const hasPaper = (course.assignmentDate && course.assignmentDate !== 'نامشخص' && course.assignmentDate !== 'ندارد' && JalaliDateEngine.isValidJalaliString(course.assignmentDate)) ||
                       course.examFormat === 'research_paper' ||
                       course.examFormat === 'no_written_exam' ||
                       course.examFormat === 'mixed';

      if (hasPaper) {
        const paperDeadline = (course.assignmentDate && JalaliDateEngine.isValidJalaliString(course.assignmentDate))
          ? course.assignmentDate
          : (isExamDateSet ? course.examDate : JalaliDateEngine.addDaysJalali(startDateJalali, 60));

        const sessionMinutes = Number(preferences.sessionDurationMinutes) || 75;
        const researchSteps = [
          {
            title: `${course.name} — پژوهش کلاسی: گام ۱. تعیین مسئله، طرح تحقیق و گردآوری منابع`,
            topic: 'تعیین مسئله و منابع اولیه پژوهش',
            obj: 'صورت‌بندی پرسش اصلی، تحدید قلمرو زمانی-موضوعی تاریخ ایران دوره اسلامی و تهیه کتاب‌شناسی توصیفی',
            activity: 'research_paper',
            priorityBonus: 28
          },
          {
            title: `${course.name} — پژوهش کلاسی: گام ۲. فیش‌برداری و نقد منابع دست‌اول و تحلیل اسنادی`,
            topic: 'فیش‌برداری و نقد منابع دست‌اول',
            obj: 'استخراج داده‌های روایی، تحلیل تطبیقی دیدگاه مورخان متقدم و نقد درونی و بیرونی متون',
            activity: 'source_criticism',
            priorityBonus: 24
          },
          {
            title: `${course.name} — پژوهش کلاسی: گام ۳. نگارش ساختار، تدوین فصول و پیش‌نویس مقاله`,
            topic: 'نگارش پیش‌نویس متن پژوهش',
            obj: 'تنظیم مدخل‌ها، ارجاع‌دهی دقیق علمی و نگارش بدنه اصلی استدلال تاریخی',
            activity: 'essay_practice',
            priorityBonus: 20
          },
          {
            title: `${course.name} — پژوهش کلاسی: گام ۴. ویرایش نهایی، استناددهی و جمع‌بندی مقاله`,
            topic: 'ویرایش نهایی و تدوین نتیجه‌گیری',
            obj: 'بازخوانی انتقادی، کنترل ارجاعات و یکدست‌سازی متن برای تحویل به استاد',
            activity: 'research_paper',
            priorityBonus: 16
          }
        ];

        researchSteps.forEach(rs => {
          workUnits.push({
            courseId: course.id,
            courseName: course.name,
            resourceId: '',
            resourceTitle: 'پژوهش و مقاله کلاسی',
            title: rs.title,
            rangeOrTopic: rs.topic,
            pagesCount: 0,
            durationMinutes: sessionMinutes,
            objective: rs.obj,
            activityType: rs.activity,
            priorityScore: basePriority + rs.priorityBonus,
            deadlineJalali: paperDeadline
          });
          totalRequiredHoursAllCourses += (sessionMinutes / 60);
        });
      }
    });

    workUnits.sort((a, b) => b.priorityScore - a.priorityScore);

    const bufferRatio = (Number(preferences.bufferPercent) || 20) / 100;
    const effectiveDailyMaxMinutes = Math.round((Number(preferences.dailyMaxHours) || 6) * 60 * (1 - bufferRatio));
    const effectiveWeeklyMaxMinutes = Math.round((Number(preferences.weeklyMaxHours) || 36) * 60 * (1 - bufferRatio));

    const netCapacityHoursHorizon = (effectiveWeeklyMaxMinutes / 60) * (horizonDays / 7);
    if (totalRequiredHoursAllCourses > netCapacityHoursHorizon) {
      conflicts.push(
        `هشدار بار کاری ناممکن در افق زمانی فعلی: مجموع حجم کار باقیمانده (${JalaliDateEngine.toPersianDigits(totalRequiredHoursAllCourses.toFixed(1))} ساعت) از ظرفیت خالص قابل برنامه‌ریزی شما در ${JalaliDateEngine.toPersianDigits(horizonDays)} روز آینده (${JalaliDateEngine.toPersianDigits(netCapacityHoursHorizon.toFixed(1))} ساعت با احتساب ${JalaliDateEngine.toPersianDigits(preferences.bufferPercent)}٪ زمان جبرانی) بیشتر است. سامانه مهم‌ترین اولویت‌ها را زمانبندی کرده است.`
      );
    }

    let unitIndex = 0;
    let currentWeekMinutes = 0;

    for (let dayOffset = 0; dayOffset < horizonDays && unitIndex < workUnits.length; dayOffset++) {
      const currentJalaliDate = JalaliDateEngine.addDaysJalali(startDateJalali, dayOffset);
      const weekdayName = JalaliDateEngine.getWeekdayName(currentJalaliDate);

      if (dayOffset % 7 === 0) currentWeekMinutes = 0;
      if (currentWeekMinutes >= effectiveWeeklyMaxMinutes) continue;

      const dayMaxMinutes = (weekdayName === 'جمعه')
        ? Math.round(effectiveDailyMaxMinutes * 0.5)
        : effectiveDailyMaxMinutes;

      const dayClasses = courses.filter(c => c.classDay === weekdayName && c.classDay !== 'نامشخص' && c.classStartTime && c.classEndTime);

      // جلسات از قبل انجام‌شده، جزئی یا دستی ثبت‌شده در این روز به عنوان بازه‌های اشغال‌شده
      const existingBusyTasks = (existingTasks || []).filter(t =>
        t.date === currentJalaliDate &&
        (t.status === 'completed' || t.status === 'partial' || t.isManual) &&
        t.startTime && t.endTime
      );

      const existingBusyMinutes = (existingTasks || [])
        .filter(t => t.date === currentJalaliDate && (t.status === 'completed' || t.status === 'partial' || t.isManual))
        .reduce((sum, t) => sum + (Number(t.actualDurationMinutes || t.durationMinutes) || 0), 0);

      const [wakeH, wakeM] = (preferences.wakingStart || '08:00').split(':').map(Number);
      const [sleepH, sleepM] = (preferences.wakingEnd || '22:00').split(':').map(Number);
      let cursorMinutes = wakeH * 60 + (wakeM || 0);
      const endDayMinutes = sleepH * 60 + (sleepM || 0);

      // برای روز اول (امروز)، نقطه شروع نباید قبل از ساعت فعلی باشد
      if (dayOffset === 0) {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (currentMins > cursorMinutes) {
          cursorMinutes = Math.min(endDayMinutes, Math.ceil((currentMins + 15) / 15) * 15);
        }
      }

      let scheduledTodayMinutes = existingBusyMinutes;
      currentWeekMinutes += existingBusyMinutes;

      while (
        unitIndex < workUnits.length &&
        scheduledTodayMinutes + workUnits[unitIndex].durationMinutes <= dayMaxMinutes &&
        currentWeekMinutes + workUnits[unitIndex].durationMinutes <= effectiveWeeklyMaxMinutes
      ) {
        const unit = workUnits[unitIndex];
        const slotStartMin = cursorMinutes;
        const slotEndMin = cursorMinutes + unit.durationMinutes;

        if (slotEndMin > endDayMinutes) break;

        const fmtTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
        const candidateStart = fmtTime(slotStartMin);
        const candidateEnd = fmtTime(slotEndMin);

        // تداخل‌سنجی همزمان با کلاس‌های دانشگاه و جلسات مطالعه انجام‌شده/دستی
        const overlappingClass = dayClasses.find(cls =>
          this.isTimeOverlapping(candidateStart, candidateEnd, cls.classStartTime, cls.classEndTime)
        );
        const overlappingTask = existingBusyTasks.find(bt =>
          this.isTimeOverlapping(candidateStart, candidateEnd, bt.startTime, bt.endTime)
        );

        if (overlappingClass || overlappingTask) {
          const blockerEnd = overlappingClass ? overlappingClass.classEndTime : overlappingTask.endTime;
          const [ceH, ceM] = blockerEnd.split(':').map(Number);
          cursorMinutes = (ceH * 60 + ceM) + 20; // ۲۰ دقیقه استراحت
          continue;
        }

        if (unit.deadlineJalali && unit.deadlineJalali !== 'نامشخص' && JalaliDateEngine.isValidJalaliString(unit.deadlineJalali) && JalaliDateEngine.diffDaysJalali(currentJalaliDate, unit.deadlineJalali) < 0) {
          warnings.push(`جلسه «${unit.title}» به دلیل کمبود ظرفیت، پس از تاریخ امتحان (${JalaliDateEngine.toPersianDigits(unit.deadlineJalali)}) قرار می‌گیرد.`);
        }

        generatedTasks.push({
          id: `task_${Date.now()}_${dayOffset}_${unitIndex}`,
          courseId: unit.courseId,
          resourceId: unit.resourceId,
          title: unit.title,
          rangeOrTopic: unit.rangeOrTopic,
          date: currentJalaliDate,
          startTime: candidateStart,
          endTime: candidateEnd,
          durationMinutes: unit.durationMinutes,
          objective: unit.objective,
          activityType: unit.activityType,
          priority: Math.round(unit.priorityScore),
          status: 'pending',
          actualDurationMinutes: 0,
          completedPagesCount: 0,
          pagesTargetCount: unit.pagesCount || 0,
          notes: '',
          createdAt: new Date().toISOString()
        });

        scheduledTodayMinutes += unit.durationMinutes;
        currentWeekMinutes += unit.durationMinutes;
        cursorMinutes = slotEndMin + 20; // ۲۰ دقیقه استراحت بین جلسات
        unitIndex++;
      }
    }

    const unscheduledCount = workUnits.length - unitIndex;
    if (unscheduledCount > 0) {
      warnings.push(`${JalaliDateEngine.toPersianDigits(unscheduledCount)} نشست مطالعه خارج از افق ${JalaliDateEngine.toPersianDigits(horizonDays)} روزه قرار گرفت که در دوره بعدی زمانبندی خواهد شد.`);
    }

    return {
      generatedTasks,
      completedTasksPreserved: completedTasks.length,
      totalRequiredHours: totalRequiredHoursAllCourses,
      netCapacityHours: netCapacityHoursHorizon,
      paceAdjustmentFactor,
      conflicts,
      warnings
    };
  }
}

/*************************************************************************
 * ۴. ماژول یکپارچه‌سازی Gemini API + پارسر هوشمند پشتیبان فارسی
 *************************************************************************/
class GeminiAdvisorService {
  getConfig() {
    const storageMode = localStorage.getItem('gemini_storage_mode') || 'session';
    const apiKey = storageMode === 'local'
      ? (localStorage.getItem('gemini_api_key') || '')
      : (sessionStorage.getItem('gemini_api_key') || '');
    let model = localStorage.getItem('gemini_model_id') || 'gemini-3.8-flash';

    // مهاجرت خودکار مدل‌های قدیمی سری ۲.۵ به نسل ۳
    if (model === 'gemini-2.5-pro') {
      model = 'gemini-3.1-pro-preview';
      localStorage.setItem('gemini_model_id', model);
    } else if (model.includes('2.5') || model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-lite') {
      model = 'gemini-3.8-flash';
      localStorage.setItem('gemini_model_id', model);
    }

    return { apiKey: apiKey.trim(), model, storageMode };
  }

  saveConfig({ apiKey, model, storageMode }) {
    localStorage.setItem('gemini_storage_mode', storageMode);
    localStorage.setItem('gemini_model_id', model);
    sessionStorage.removeItem('gemini_api_key');
    localStorage.removeItem('gemini_api_key');
    if (apiKey) {
      if (storageMode === 'local') {
        localStorage.setItem('gemini_api_key', apiKey.trim());
      } else {
        sessionStorage.setItem('gemini_api_key', apiKey.trim());
      }
    }
  }

  clearKey() {
    sessionStorage.removeItem('gemini_api_key');
    localStorage.removeItem('gemini_api_key');
  }

  async testConnection(customApiKey, customModel) {
    const cfg = this.getConfig();
    const apiKey = (customApiKey !== undefined ? customApiKey : cfg.apiKey).trim();
    const model = (customModel !== undefined ? customModel : cfg.model).trim() || 'gemini-3.8-flash';
    if (!apiKey) throw new Error('کلید API وارد نشده است. لطفاً ابتدا کلید اختصاصی خود را در کادر وارد فرمایید.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'سلام، این یک پیام تست برای بررسی اتصال است.' }] }]
      })
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `کد خطا: ${resp.status}`);
    }
    return true;
  }

  buildGeminiContents(previousHistory, currentPayload) {
    const contents = [];
    const validHistory = (previousHistory || []).slice(-16);

    for (const m of validHistory) {
      const isUser = (m.role === 'user' || m.sender === 'user');
      const role = isUser ? 'user' : 'model';
      const text = isUser
        ? m.text
        : (m.rawJson || JSON.stringify({
            replyText: m.text,
            epistemicBreakdown: m.epistemicBreakdown || {},
            proposedCourses: m.proposedCourses || [],
            proposedResources: m.proposedResources || []
          }));
      if (!text || !text.trim()) continue;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n\n${text}`;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n\n${currentPayload}`;
    } else {
      contents.push({ role: 'user', parts: [{ text: currentPayload }] });
    }

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    return contents;
  }

  async analyzeStudentMessage(userMessage, compactContext, previousHistory = []) {
    const { apiKey, model } = this.getConfig();
    if (!apiKey) {
      const fallbackResult = this.deterministicPersianExtractor(userMessage, compactContext, previousHistory);
      fallbackResult.isOfflineFallback = true;
      return fallbackResult;
    }

    const systemInstruction = `
شما مشاور ارشد تحصیلی و برنامه‌ریز هوشمند ویژه دانشجوی کارشناسی ارشد «تاریخ ایران دوره اسلامی» هستید.
هدف دانشجو کسب نمره ۱۸ تا ۲۰ از ۲۰ از طریق برنامه‌ریزی واقع‌بینانه، نقد منبع، تحلیل تاریخ‌نگارانه و مرور با فاصله است.
هرگز هیچ نمره‌ای را تضمین نکنید و هرگز صفحات کتاب، سرفصل یا تاریخ امتحانی را از خودتان جعل نکنید.
تاریخ امروز به تقویم هجری شمسی (منطقه زمانی تهران): ${compactContext.todayJalali}.

اصول حیاتی گفتگوی چندنوبتی (Multi-turn Memory):
۱. شما در یک گفتگوی مستمر (Multi-turn Conversation) با دانشجو قرار دارید. تمام پیام‌های قبلی، اسامی دروس، نام اساتید، ساعات کلاس و تاریخ امتحانات معرفی‌شده را در حافظه فعال نگه دارید و هرگز اطلاعاتی که دانشجو قبلاً گفته است را دوباره از او نپرسید!
۲. اگر دانشجو اطلاعات تکمیلی داد (مانند: «همه دروس ۲ واحده»، یا اعلام تاریخ شروع کلاس‌ها و وضعیت منابع)، دروس قبلی را با این اطلاعات جدید بروزرسانی کنید و پاسخ پیوسته و هوشمندانه بدهید.
۳. به صورت دقیق بین ۴ دسته اطلاعات تمایز قائل شوید:
   - confirmedFacts: اطلاعات قطعی که دانشجو صریحاً بیان کرده است.
   - userEstimates: تخمین‌های دانشجو (مانند «حدود ۳۰۰ صفحه»).
   - aiRecommendations: پیشنهادهای روش‌شناختی شما برای مطالعه تاریخ ایران (مانند تهیه جدول گاهشمار، نقد منبع، یا مقایسه روایت‌ها).
   - missingOrAmbiguous: اطلاعات ناقص، بلاتکلیف یا مبهم.
۴. قاعده حیاتی برای موارد نامشخص یا در انتظار اعلام استاد:
   - اگر دانشجو گفت تاریخ امتحان، ساعت کلاس، بارم‌بندی، یا صفحات منبع مشخص نیست، اعلام نشده یا وجود ندارد، هرگز مقدار فرضی جعل نکنید؛ مقدار examDate را "نامشخص" یا "ندارد" بگذارید و صفحات را "نامشخص" و 0 قرار دهید.
۵. پاسخ خود را کاملاً در قالب JSON زیر برگردانید:
{
  "replyText": "پاسخ صمیمی، علمی و دقیق به زبان فارسی متناسب با مکالمه جاری با یادآوری هوشمندانه دروس قبلی",
  "epistemicBreakdown": {
    "confirmedFacts": ["..."],
    "userEstimates": ["..."],
    "aiRecommendations": ["..."],
    "missingOrAmbiguous": ["..."]
  },
  "proposedCourses": [
    {
      "name": "نام درس",
      "units": 2,
      "instructor": "نام استاد در صورت ذکر",
      "classDay": "شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنجشنبه|نامشخص|",
      "classStartTime": "HH:MM",
      "classEndTime": "HH:MM",
      "examDate": "YYYY/MM/DD یا نامشخص یا ندارد",
      "examFormat": "essay_analytical|historiographical|research_paper|factual_chronological|oral|no_written_exam|unknown",
      "targetGrade": 19,
      "difficulty": 3
    }
  ],
  "proposedResources": [
    {
      "courseName": "نام درس مرتبط",
      "title": "عنوان کتاب یا منبع",
      "author": "نام نویسنده در صورت ذکر شدن",
      "assignedRanges": "مثال: 1-300 یا نامشخص",
      "totalPages": 0,
      "isEstimate": true
    }
  ]
}`;

    const currentPayload = `[زمینه و پایگاه داده تحصیلی:
- تاریخ امروز: ${compactContext.todayJalali}
- دروس از قبل ثبت‌شده در پایگاه داده: ${JSON.stringify(compactContext.coursesSummary || [])}
- پیش‌نویس‌های دروس در حال بررسی (تاییدنشده): ${JSON.stringify(compactContext.pendingProposalsSummary || [])}]

پیام جدید دانشجو:
«${userMessage}»`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const contents = this.buildGeminiContents(previousHistory, currentPayload);

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `خطای سرور: ${resp.status}`);
      }

      const data = await resp.json();
      const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawJsonText);
      return this.validateAndSanitizeAIResponse(parsed, compactContext.todayJalali, rawJsonText);
    } catch (err) {
      console.warn('خطا در فراخوانی Gemini API:', err);
      const fallback = this.deterministicPersianExtractor(userMessage, compactContext, previousHistory);
      fallback.apiErrorWarning = `ارتباط با Gemini API با خطا مواجه شد (${err.message}). تحلیل به وسیله موتور قواعدمند محلی انجام شد.`;
      return fallback;
    }
  }

  validateAndSanitizeAIResponse(raw, todayJalali, rawJsonText = '') {
    const currentYear = todayJalali.split('/')[0];
    return {
      rawJson: rawJsonText,
      replyText: typeof raw?.replyText === 'string' && raw.replyText.trim()
        ? raw.replyText
        : 'اطلاعات شما بررسی و پیش‌نویس‌های ساختاریافته استخراج شد. لطفاً در پنل کناری تایید فرمایید.',
      epistemicBreakdown: {
        confirmedFacts: Array.isArray(raw?.epistemicBreakdown?.confirmedFacts) ? raw.epistemicBreakdown.confirmedFacts : [],
        userEstimates: Array.isArray(raw?.epistemicBreakdown?.userEstimates) ? raw.epistemicBreakdown.userEstimates : [],
        aiRecommendations: Array.isArray(raw?.epistemicBreakdown?.aiRecommendations) ? raw.epistemicBreakdown.aiRecommendations : [],
        missingOrAmbiguous: Array.isArray(raw?.epistemicBreakdown?.missingOrAmbiguous) ? raw.epistemicBreakdown.missingOrAmbiguous : []
      },
      proposedCourses: Array.isArray(raw?.proposedCourses) ? raw.proposedCourses.map(c => ({
        name: String(c.name || 'درس جدید').trim(),
        code: String(c.code || '').trim(),
        instructor: String(c.instructor || '').trim(),
        units: Number(c.units) || 2,
        classDay: JalaliDateEngine.normalizeWeekday(String(c.classDay || '').trim()),
        classStartTime: String(c.classStartTime || '10:00').trim(),
        classEndTime: String(c.classEndTime || '12:00').trim(),
        examDate: (c.examDate && c.examDate !== 'نامشخص' && c.examDate !== 'ندارد' && JalaliDateEngine.isValidJalaliString(c.examDate))
          ? JalaliDateEngine.normalizeJalali(c.examDate)
          : (c.examDate === 'ندارد' ? 'ندارد' : (c.examDate || 'نامشخص')),
        examFormat: c.examFormat || (c.examDate === 'ندارد' ? 'no_written_exam' : 'essay_analytical'),
        targetGrade: Number(c.targetGrade) || 19,
        difficulty: Number(c.difficulty) || 3
      })) : [],
      proposedResources: Array.isArray(raw?.proposedResources) ? raw.proposedResources.map(r => ({
        courseName: String(r.courseName || '').trim(),
        title: String(r.title || 'منبع مطالعاتی').trim(),
        author: String(r.author || '').trim(),
        assignedRanges: String(r.assignedRanges || (r.totalPages ? `1-${r.totalPages}` : 'نامشخص')),
        totalPages: Number(r.totalPages) || 0,
        isEstimate: Boolean(r.isEstimate)
      })) : []
    };
  }

  extractCourseFromSingleLine(line, currentYear) {
    let clean = line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!clean) return null;
    if (/^این\s+ترم.*(?:عبارتند|شامل|دروس|دارم)/i.test(clean) && !/\d{1,2}:\d{2}/.test(clean)) return null;

    const weekdays = ['چهارشنبه', 'پنجشنبه', 'سه‌شنبه', 'سه شنبه', 'یکشنبه', 'دوشنبه', 'شنبه', 'جمعه'];
    let classDay = '';
    for (const w of weekdays) {
      if (clean.includes(w)) {
        classDay = JalaliDateEngine.normalizeWeekday(w);
        break;
      }
    }

    let instructor = '';
    const instMatch = clean.match(/(?:با\s+)?استاد\s+([^0-9\(\)\:\.\,،]+?)(?=\s*(?:یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنجشنبه|شنبه|ساعت|\d{1,2}:\d{2}|$))/);
    if (instMatch) {
      instructor = `استاد ${instMatch[1].trim()}`;
    }

    let classStartTime = '10:00';
    let classEndTime = '12:00';
    const timeMatches = [...clean.matchAll(/(\d{1,2}:\d{2})\s*(?:-|تا)\s*(\d{1,2}:\d{2})/g)];
    if (timeMatches.length > 0) {
      classStartTime = timeMatches[0][1];
      classEndTime = timeMatches[0][2];
    }

    let examDate = 'نامشخص';
    let examTime = '09:00';
    const dateMatch = clean.match(/امتحان[^\d]*(\d{4}\/\d{1,2}\/\d{1,2})(?:\s*(\d{1,2}:\d{2}))?/);
    if (dateMatch) {
      examDate = JalaliDateEngine.normalizeJalali(dateMatch[1]);
      if (dateMatch[2]) examTime = dateMatch[2];
    }

    let courseName = clean
      .replace(/(?:با\s+)?استاد\s+[^0-9\(\)\:\.\,،]+?(?=\s*(?:یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنجشنبه|شنبه|ساعت|\d{1,2}:\d{2}|$))/g, '')
      .replace(/امتحان[^\n]*/g, '')
      .replace(/(?:چهارشنبه|پنجشنبه|سه‌شنبه|سه شنبه|یکشنبه|دوشنبه|شنبه)(?:\s*ها)?/g, '')
      .replace(/ساعت\s*\d{1,2}:\d{2}\s*(?:-|تا)\s*\d{1,2}:\d{2}/g, '')
      .replace(/\d{1,2}:\d{2}\s*(?:-|تا)\s*\d{1,2}:\d{2}/g, '')
      .replace(/(\d+|یک|دو|سه|چهار)\s*واحد/g, '')
      .replace(/^[\s\-–•\*\d\.\(\)]+/, '')
      .replace(/[:\-–\s]+$/, '')
      .trim();

    if (!courseName || courseName.length < 3) return null;

    return {
      name: courseName,
      instructor,
      units: 2,
      classDay,
      classStartTime,
      classEndTime,
      examDate,
      examTime,
      examFormat: 'essay_analytical',
      targetGrade: 19,
      difficulty: 3
    };
  }

  deterministicPersianExtractor(text, compactContext = {}, previousHistory = []) {
    const clean = JalaliDateEngine.toEnglishDigits(text);
    const todayJ = (compactContext && compactContext.todayJalali) || JalaliDateEngine.todayJalali();
    const currentYear = todayJ.split('/')[0];

    const confirmedFacts = [];
    const userEstimates = [];
    const aiRecommendations = [];
    const missingOrAmbiguous = [];
    const proposedCourses = [];
    const proposedResources = [];

    // ۱. استخراج چندخطی دروس
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      lines.forEach(line => {
        const c = this.extractCourseFromSingleLine(line, currentYear);
        if (c) {
          proposedCourses.push(c);
          confirmedFacts.push(`درس «${c.name}» (${c.classDay ? `کلاس ${c.classDay}` : 'کلاس نامشخص'} | امتحان ${c.examDate}) ثبت شد.`);
        }
      });
    }

    // ۲. بررسی اعلام تعداد واحدها برای همه دروس
    const allUnitsMatch = clean.match(/همه\s+(?:دروس|درس\s*ها)?\s*(\d+|یک|دو|سه|چهار)\s*واحد/i) || clean.match(/در\s+مجموع\s+(\d+)\s*واحد/);
    if (allUnitsMatch) {
      const wordMap = { 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4 };
      const parsedUnits = wordMap[allUnitsMatch[1]] || parseInt(allUnitsMatch[1], 10) || 2;
      confirmedFacts.push(`تعداد واحدهای تمام دروس بر روی ${JalaliDateEngine.toPersianDigits(parsedUnits)} واحد تنظیم شد.`);

      if (Array.isArray(compactContext.pendingProposalsSummary) && compactContext.pendingProposalsSummary.length > 0) {
        compactContext.pendingProposalsSummary.forEach(p => {
          if (p.type === 'course' && p.name) {
            proposedCourses.push({
              name: p.name,
              units: parsedUnits,
              instructor: p.instructor || '',
              classDay: p.classDay || '',
              classStartTime: p.classStartTime || '10:00',
              classEndTime: p.classEndTime || '12:00',
              examDate: p.examDate || 'نامشخص',
              examFormat: 'essay_analytical',
              targetGrade: 19,
              difficulty: 3
            });
          }
        });
      }
    }

    // ۳. اگر حالت چندخطی نبود، استخراج تک‌درس
    if (proposedCourses.length === 0) {
      const singleCourse = this.extractCourseFromSingleLine(clean, currentYear);
      if (singleCourse) {
        proposedCourses.push(singleCourse);
        confirmedFacts.push(`نام درس شناسایی‌شده: «${singleCourse.name}»`);
      }
    }

    // ۴. استخراج اطلاعات منابع مطالعاتی
    const pagesMatch = clean.match(/(حدود\s*)?(\d+)\s*صفحه/);
    let totalPages = pagesMatch ? parseInt(pagesMatch[2], 10) : 0;
    const isPageEstimate = Boolean(pagesMatch && pagesMatch[1]);
    if (totalPages > 0) {
      if (isPageEstimate) {
        userEstimates.push(`حجم مطالعه حدود ${JalaliDateEngine.toPersianDigits(totalPages)} صفحه (تخمین اولیه)`);
      } else {
        confirmedFacts.push(`حجم مطالعه: ${JalaliDateEngine.toPersianDigits(totalPages)} صفحه`);
      }
    }

    let bookTitle = '';
    const bookMatch = clean.match(/کتاب\s+([^\.،]+?)(?:\s+است|\s+و\s+|\s+حدود|$)/);
    if (bookMatch) {
      bookTitle = `کتاب ${bookMatch[1].trim()}`;
      confirmedFacts.push(`منبع اصلی: «${bookTitle}»`);
    }

    if (bookTitle || totalPages > 0) {
      const targetCourseName = proposedCourses[0]?.name || 'تاریخ صفویه';
      proposedResources.push({
        courseName: targetCourseName,
        title: bookTitle || `منبع اصلی ${targetCourseName}`,
        author: (bookTitle && bookTitle.includes('ساوری')) ? 'راجر ساوری' : '',
        assignedRanges: totalPages > 0 ? `1-${totalPages}` : 'نامشخص',
        totalPages: totalPages || 0,
        isEstimate: isPageEstimate
      });
    }

    aiRecommendations.push(
      'برای تسلط در مقطع کارشناسی ارشد تاریخ ایران اسلامی، استخراج گاهشمار و نقد متون دست‌اول توصیه می‌شود.',
      'پیشنهاد می‌شود در اولین جلسه هر درس، سرفصل‌های دقیق و منابع الزامی را از استاد جویا شوید.'
    );

    const replyLines = [
      `پیام شما بررسی شد و اطلاعات تحصیلی با موفقیت در پیش‌نویس‌های سامانه قرار گرفتند.`
    ];
    if (proposedCourses.length > 0) {
      replyLines.push(`تعداد **${JalaliDateEngine.toPersianDigits(proposedCourses.length)} درس** جهت تایید نهایی در پنل «پیش‌نویس رکوردهای استخراج‌شده» آماده است.`);
    }

    return {
      replyText: replyLines.join('\n\n'),
      epistemicBreakdown: {
        confirmedFacts,
        userEstimates,
        aiRecommendations,
        missingOrAmbiguous
      },
      proposedCourses,
      proposedResources
    };
  }
}

/*************************************************************************
 * ۴.۵. موتور صوتی داخلی، آلارم تقویم و اعلان‌های سیستم (Web Audio & Notifications)
 *************************************************************************/
class SoundAndAlarmService {
  constructor(app) {
    this.app = app;
    this.audioCtx = null;
    this.isMuted = localStorage.getItem('study_sound_muted') === 'true';
    this.notifiedAlarms = new Set();
    this.alarmCheckerInterval = null;
  }

  init() {
    this.updateMuteUI();
    this.startScheduleChecker();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('study_sound_muted', String(this.isMuted));
    this.updateMuteUI();
    if (!this.isMuted) {
      this.playChime(1); // پخش صدای آزمایشی
      this.app.showToast('صدای هشدارها و زنگ مطالعه فعال شد.', 'info');
    } else {
      this.app.showToast('صدای هشدارها بی‌صدا شد.', 'info');
    }
    return this.isMuted;
  }

  updateMuteUI() {
    const icon = document.getElementById('sound-icon');
    if (icon) icon.textContent = this.isMuted ? '🔇' : '🔊';
  }

  playChime(type = 1) {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 1) {
        // زنگ اول (شروع مطالعه / پایان استراحت): ملودی افزایشی پرانرژی C5 -> E5 -> G5 -> C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.11);
          gain.gain.setValueAtTime(0, now + idx * 0.11);
          gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.11 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.11);
          osc.stop(now + idx * 0.11 + 0.3);
        });
      } else if (type === 2) {
        // زنگ دوم (پایان پومودورو / شروع استراحت): ملودی آرامش‌بخش G5 -> E5 -> C5 -> A4
        const notes = [783.99, 659.25, 523.25, 440.00];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.16);
          gain.gain.setValueAtTime(0, now + idx * 0.16);
          gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.16 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.42);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.16);
          osc.stop(now + idx * 0.16 + 0.45);
        });
      } else if (type === 3) {
        // زنگ سوم (آلارم تقویم و ساعت مطالعه): ناقوس دو مرحله‌ای 880Hz -> 1174Hz
        const chimes = [880, 1174.66];
        chimes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.22);
          gain.gain.setValueAtTime(0, now + idx * 0.22);
          gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.22 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.22);
          osc.stop(now + idx * 0.22 + 0.7);
        });
      }
    } catch (e) {
      console.warn('Audio synthesis note:', e);
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
  }

  sendSystemNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: './icon.svg',
          dir: 'rtl',
          lang: 'fa-IR'
        });
      } catch (e) {}
    }
  }

  startScheduleChecker() {
    if (this.alarmCheckerInterval) clearInterval(this.alarmCheckerInterval);
    this.alarmCheckerInterval = setInterval(() => {
      this.checkCurrentTimeAlarms();
    }, 30000); // پایش هر ۳۰ ثانیه
  }

  checkCurrentTimeAlarms() {
    const todayJ = JalaliDateEngine.todayJalali();
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const pendingTodayTasks = (this.app.state.tasks || []).filter(t =>
      t.date === todayJ &&
      t.status === 'pending' &&
      t.startTime
    );

    for (const t of pendingTodayTasks) {
      const key = `${todayJ}_${t.id}_${t.startTime}`;
      if (t.startTime === currentHHMM && !this.notifiedAlarms.has(key)) {
        this.notifiedAlarms.add(key);
        this.triggerTaskAlarm(t);
        break;
      }
    }
  }

  triggerTaskAlarm(task) {
    this.playChime(3);
    const crs = (this.app.state.courses || []).find(c => c.id === task.courseId);
    const courseName = crs ? crs.name : 'درس تاریخ';
    this.sendSystemNotification(
      'زمان جلسه مطالعه برنامه‌ریزی‌شده فرا رسید!',
      `${courseName}: ${task.title} (ساعت ${task.startTime})`
    );
    this.app.showCalendarAlarmModal(task);
  }
}

/*************************************************************************
 * ۴.۶. تایمر هوشمند پومودورو و مکانیک رشد گیاه در جنگل (Living Plant Pomodoro)
 *************************************************************************/
class PomodoroManager {
  constructor(app) {
    this.app = app;
    this.state = 'idle'; // 'idle', 'running', 'paused'
    this.phase = 'work'; // 'work', 'short_break', 'long_break'
    this.workDurationMin = 25;
    this.breakDurationMin = 5;
    this.longBreakDurationMin = 15;
    this.cyclesCompleted = 0;
    this.attachedTaskId = null;
    this.targetTimestamp = null;
    this.remainingMs = 25 * 60 * 1000;
    this.timerInterval = null;
    this.wakeLock = null;
  }

  init() {
    this.renderPlantStage(0);
  }

  openModal(taskId = null) {
    if (taskId) {
      this.attachedTaskId = taskId;
      const t = this.app.state.tasks.find(x => x.id === taskId);
      if (t && t.durationMinutes && this.state === 'idle') {
        this.workDurationMin = Number(t.durationMinutes) || 25;
        this.breakDurationMin = (this.workDurationMin >= 50) ? 10 : 5;
        this.remainingMs = this.workDurationMin * 60 * 1000;
      }
    }
    this.renderModalUI();
    const modal = document.getElementById('pomodoro-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    this.app.sound.requestNotificationPermission();
  }

  closeModal() {
    const modal = document.getElementById('pomodoro-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  setPreset(workMin, breakMin) {
    if (this.state === 'running') {
      if (!confirm('تایمر پومودورو در حال اجرا است. آیا مایلید تایمر ریست شود؟')) return;
      this.pauseTimer();
    }

    if (workMin === 'custom') {
      if (this.attachedTaskId) {
        const t = this.app.state.tasks.find(x => x.id === this.attachedTaskId);
        this.workDurationMin = Number(t?.durationMinutes) || 45;
      } else {
        this.workDurationMin = Number(this.app.state.preferences?.sessionDurationMinutes) || 60;
      }
      this.breakDurationMin = 10;
    } else {
      this.workDurationMin = workMin;
      this.breakDurationMin = breakMin;
    }

    this.phase = 'work';
    this.state = 'idle';
    this.remainingMs = this.workDurationMin * 60 * 1000;
    this.targetTimestamp = null;
    this.renderModalUI();
  }

  async toggleTimer() {
    if (this.state === 'running') {
      this.pauseTimer();
    } else {
      await this.startTimer();
    }
  }

  async startTimer() {
    this.state = 'running';
    this.targetTimestamp = Date.now() + this.remainingMs;
    this.app.sound.playChime(1);
    this.acquireWakeLock();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.tick();
    }, 250);

    this.renderModalUI();
  }

  pauseTimer() {
    this.state = 'paused';
    if (this.targetTimestamp) {
      this.remainingMs = Math.max(0, this.targetTimestamp - Date.now());
    }
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.releaseWakeLock();
    this.renderModalUI();
  }

  tick() {
    if (!this.targetTimestamp) return;
    const now = Date.now();
    this.remainingMs = Math.max(0, this.targetTimestamp - now);

    if (this.remainingMs <= 0) {
      this.onPhaseCompleted();
    } else {
      this.renderProgressOnly();
    }
  }

  async acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        const lockEl = document.getElementById('pomo-screen-lock-status');
        if (lockEl) lockEl.textContent = 'صفحه نمایش روشن نگه داشته می‌شود';
      } catch (e) {}
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  async onPhaseCompleted() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.releaseWakeLock();

    if (this.phase === 'work') {
      this.cyclesCompleted++;
      this.app.sound.playChime(2);
      this.app.sound.sendSystemNotification('خسته نباشید! وقت استراحت است', 'گیاه شما با موفقیت شکوفا شد و در جنگل کاشته شد.');

      // افزودن زمان واقعی به تسک متصل
      if (this.attachedTaskId) {
        const t = this.app.state.tasks.find(x => x.id === this.attachedTaskId);
        if (t) {
          t.actualDurationMinutes = (Number(t.actualDurationMinutes) || 0) + this.workDurationMin;
          if (t.status === 'pending') t.status = 'partial';
          await this.app.db.put('tasks', t);
        }
      }

      // ثبت و کاشت گیاه در پایگاه داده جنگل
      await this.savePlantToForest();

      // تغییر فاز به استراحت
      if (this.cyclesCompleted % 4 === 0) {
        this.phase = 'long_break';
        this.remainingMs = this.longBreakDurationMin * 60 * 1000;
      } else {
        this.phase = 'short_break';
        this.remainingMs = this.breakDurationMin * 60 * 1000;
      }

      this.state = 'idle';
      this.targetTimestamp = null;
      this.app.renderForestView();
      this.renderModalUI();
      this.app.showToast('تبریک! نشست مطالعه با موفقیت تکمیل شد و گیاه جدید به جنگل شما افزوده گردید.', 'success');
    } else {
      // پایان استراحت
      this.app.sound.playChime(1);
      this.app.sound.sendSystemNotification('پایان استراحت', 'وقت شروع جلسه جدید مطالعه است!');
      this.phase = 'work';
      this.remainingMs = this.workDurationMin * 60 * 1000;
      this.state = 'idle';
      this.targetTimestamp = null;
      this.renderModalUI();
    }
  }

  async savePlantToForest() {
    const existingCount = (this.app.state.forest || []).length;
    let plantKind = 'flower';
    let chosenType = 'flower';

    if (existingCount === 0) {
      plantKind = 'flower';
      chosenType = 'flower';
    } else if (existingCount === 1) {
      plantKind = 'sapling';
      chosenType = 'sapling';
    } else {
      // چرخه متناوب و ماندگار گیاهان و درختان ایرانی (سرو شیراز، چنار کهنسال، بلوط زاگرس، نارنج، گل لاله و نهال)
      const cyclePos = (existingCount - 2) % 6;
      if (cyclePos === 0) {
        plantKind = 'tree';
        chosenType = 'cypress';
      } else if (cyclePos === 1) {
        plantKind = 'tree';
        chosenType = 'plane';
      } else if (cyclePos === 2) {
        plantKind = 'tree';
        chosenType = 'oak';
      } else if (cyclePos === 3) {
        plantKind = 'tree';
        chosenType = 'orange';
      } else if (cyclePos === 4) {
        plantKind = 'flower';
        chosenType = 'flower';
      } else {
        plantKind = 'sapling';
        chosenType = 'sapling';
      }
    }

    const t = this.attachedTaskId ? this.app.state.tasks.find(x => x.id === this.attachedTaskId) : null;
    const crs = t ? this.app.state.courses.find(c => c.id === t.courseId) : null;

    const plantRecord = {
      id: `forest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      taskId: this.attachedTaskId || '',
      courseId: crs ? crs.id : '',
      courseName: crs ? crs.name : 'مطالعه آزاد متون تاریخ',
      taskTitle: t ? t.title : 'جلسه متمرکز پومودورو',
      durationMinutes: this.workDurationMin,
      dateJalali: JalaliDateEngine.todayJalali(),
      timestamp: Date.now(),
      plantKind,
      treeType: chosenType
    };

    await this.app.db.put('forest', plantRecord);
    if (!this.app.state.forest) this.app.state.forest = [];
    this.app.state.forest.push(plantRecord);
    this.app.touchLocalUpdate();
  }

  giveUp() {
    if (this.phase === 'work' && this.state === 'running') {
      if (!confirm('آیا مطمئن هستید که می‌خواهید تسلیم شوید؟ با لغو پیش از موعد، گیاه این نشست پژمرده شده و در جنگل کاشته نخواهد شد!')) {
        return;
      }
    }
    this.pauseTimer();
    this.phase = 'work';
    this.state = 'idle';
    this.remainingMs = this.workDurationMin * 60 * 1000;
    this.targetTimestamp = null;
    this.renderModalUI();
    this.app.showToast('نشست مطالعه لغو شد و گیاه این نشست رشد نکرد.', 'info');
  }

  skipPhase() {
    this.onPhaseCompleted();
  }

  renderModalUI() {
    // اطلاعات تسک متصل
    const taskInfoEl = document.getElementById('pomo-task-info');
    if (this.attachedTaskId) {
      const t = this.app.state.tasks.find(x => x.id === this.attachedTaskId);
      const crs = t ? this.app.state.courses.find(c => c.id === t.courseId) : null;
      if (t && taskInfoEl) {
        taskInfoEl.classList.remove('hidden');
        document.getElementById('pomo-course-name').textContent = crs ? crs.name : 'درس تاریخ';
        document.getElementById('pomo-task-title').textContent = t.title;
        document.getElementById('pomo-task-type').textContent = this.app.escapeHTML(t.activityType || 'مطالعه');
      }
    } else if (taskInfoEl) {
      taskInfoEl.classList.add('hidden');
    }

    // وضعیت دکمه استارت/توقف
    const btnToggle = document.getElementById('pomo-btn-toggle');
    const iconSpan = document.getElementById('pomo-btn-icon');
    const labelSpan = document.getElementById('pomo-btn-label');
    if (btnToggle && iconSpan && labelSpan) {
      if (this.state === 'running') {
        btnToggle.className = 'bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 text-sm';
        iconSpan.textContent = '⏸';
        labelSpan.textContent = 'توقف موقت';
      } else {
        btnToggle.className = 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 text-sm';
        iconSpan.textContent = '▶';
        labelSpan.textContent = this.state === 'paused' ? 'ادامه مطالعه' : 'شروع مطالعه';
      }
    }

    // برچسب فاز
    const phaseLabel = document.getElementById('pomo-phase-label');
    if (phaseLabel) {
      if (this.phase === 'work') {
        phaseLabel.textContent = 'نشست مطالعه عمیق متون تاریخی';
        phaseLabel.className = 'text-xs font-semibold text-emerald-700 mt-0.5';
      } else if (this.phase === 'short_break') {
        phaseLabel.textContent = 'زمان استراحت کوتاه (۵ یا ۱۰ دقیقه)';
        phaseLabel.className = 'text-xs font-semibold text-sky-700 mt-0.5';
      } else {
        phaseLabel.textContent = 'زمان استراحت طولانی (۱۵ دقیقه)';
        phaseLabel.className = 'text-xs font-semibold text-indigo-700 mt-0.5';
      }
    }

    this.renderProgressOnly();
  }

  renderProgressOnly() {
    const totalMs = (this.phase === 'work')
      ? this.workDurationMin * 60 * 1000
      : (this.phase === 'short_break' ? this.breakDurationMin * 60 * 1000 : this.longBreakDurationMin * 60 * 1000);

    const elapsedMs = Math.max(0, totalMs - this.remainingMs);
    const progressRatio = Math.min(1, Math.max(0, elapsedMs / totalMs));
    const progressPct = progressRatio * 100;

    // دایره پیشرفت SVG
    const circle = document.getElementById('pomo-progress-circle');
    if (circle) {
      const circumference = 2 * Math.PI * 88; // ~552.92
      const offset = circumference - (progressRatio * circumference);
      circle.style.strokeDashoffset = offset;
      circle.style.stroke = (this.phase === 'work') ? '#10b981' : '#0284c7';
    }

    // زمان نمایش‌یافته
    const totalSecs = Math.ceil(this.remainingMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timeDisplay = document.getElementById('pomo-time-display');
    if (timeDisplay) {
      timeDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // رندر گیاه و برچسب مرحله
    if (this.phase === 'work') {
      this.renderPlantStage(progressPct);
    } else {
      this.renderBreakGraphics();
    }
  }

  renderPlantStage(progressPct) {
    const container = document.getElementById('pomo-plant-stage-svg');
    const badge = document.getElementById('pomo-stage-badge');
    if (!container) return;

    if (progressPct < 25) {
      if (badge) badge.textContent = 'مرحله ۱: بذر در خاک و آبیاری (۰-۲۵٪)';
      container.innerHTML = `
        <svg viewBox="0 0 100 100" class="w-16 h-16 animate-pulse">
          <ellipse cx="50" cy="80" rx="36" ry="12" fill="#78350f" opacity="0.35"/>
          <ellipse cx="50" cy="73" rx="14" ry="9" fill="#854d0e"/>
          <path d="M 50 36 C 44 48, 40 56, 50 62 C 60 56, 56 48, 50 36 Z" fill="#38bdf8" opacity="0.9"/>
        </svg>
      `;
    } else if (progressPct < 60) {
      if (badge) badge.textContent = 'مرحله ۲: سر زدن جوانه سبز (۲۵-۶۰٪)';
      container.innerHTML = `
        <svg viewBox="0 0 100 100" class="w-16 h-16">
          <ellipse cx="50" cy="82" rx="36" ry="10" fill="#78350f" opacity="0.3"/>
          <path d="M 50 82 Q 50 50 50 45" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
          <path d="M 50 55 C 32 45, 30 65, 50 62 Z" fill="#4ade80"/>
          <path d="M 50 50 C 68 40, 70 60, 50 57 Z" fill="#22c55e"/>
        </svg>
      `;
    } else if (progressPct < 100) {
      if (badge) badge.textContent = 'مرحله ۳: نهال شاداب با غنچه (۶۰-۹۹٪)';
      container.innerHTML = `
        <svg viewBox="0 0 100 100" class="w-16 h-16">
          <ellipse cx="50" cy="84" rx="36" ry="10" fill="#78350f" opacity="0.3"/>
          <path d="M 50 84 Q 50 40 50 30" stroke="#713f12" stroke-width="6" stroke-linecap="round"/>
          <path d="M 50 55 Q 35 45 28 48" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>
          <path d="M 50 45 Q 65 35 72 38" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>
          <circle cx="26" cy="46" r="6" fill="#86efac"/>
          <circle cx="74" cy="36" r="6" fill="#86efac"/>
          <circle cx="50" cy="24" r="8" fill="#f43f5e"/>
          <circle cx="50" cy="24" r="3.5" fill="#fde047"/>
        </svg>
      `;
    } else {
      if (badge) badge.textContent = 'مرحله ۴: شکوفایی کامل و ثبت در جنگل! (۱۰۰٪)';
      container.innerHTML = `
        <svg viewBox="0 0 100 100" class="w-16 h-16 animate-bounce-short">
          <ellipse cx="50" cy="86" rx="40" ry="10" fill="#78350f" opacity="0.3"/>
          <path d="M 50 86 L 50 48" stroke="#5c2e0b" stroke-width="8" stroke-linecap="round"/>
          <ellipse cx="50" cy="38" rx="34" ry="26" fill="#15803d"/>
          <ellipse cx="50" cy="34" rx="26" ry="20" fill="#22c55e"/>
          <circle cx="38" cy="30" r="3.5" fill="#fde047"/>
          <circle cx="60" cy="28" r="3.5" fill="#fde047"/>
          <circle cx="50" cy="44" r="3.5" fill="#fde047"/>
        </svg>
      `;
    }
  }

  renderBreakGraphics() {
    const container = document.getElementById('pomo-plant-stage-svg');
    const badge = document.getElementById('pomo-stage-badge');
    if (!container) return;
    if (badge) badge.textContent = 'وقت استراحت، نوشیدن چای و تنفس عمیق';
    container.innerHTML = `
      <div class="text-4xl animate-bounce">☕</div>
    `;
  }
}
class GraduatePlannerApp {
  constructor() {
    this.db = new LocalAcademicDB();
    this.ai = new GeminiAdvisorService();
    this.sound = new SoundAndAlarmService(this);
    this.pomodoro = new PomodoroManager(this);
    this.currentView = 'dashboard';
    this.calendarMode = 'weekly';
    this.calendarCursorJalali = JalaliDateEngine.todayJalali();
    this.pendingAlarmTask = null;

    this.state = {
      semesters: [],
      courses: [],
      resources: [],
      tasks: [],
      assessments: [],
      mastery: [],
      chatHistory: [],
      pendingProposals: [],
      forest: [],
      lastSchedulePreview: null,
      preferences: this.loadPreferences()
    };
  }

  loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem('planner_preferences') || '{}');
      return {
        wakingStart: saved.wakingStart || '08:00',
        wakingEnd: saved.wakingEnd || '22:00',
        dailyMaxHours: Number(saved.dailyMaxHours) || 6,
        weeklyMaxHours: Number(saved.weeklyMaxHours) || 36,
        sessionDurationMinutes: Number(saved.sessionDurationMinutes) || 75,
        bufferPercent: Number(saved.bufferPercent) || 20,
        commitments: saved.commitments || '',
        timezone: 'Asia/Tehran'
      };
    } catch {
      return {
        wakingStart: '08:00',
        wakingEnd: '22:00',
        dailyMaxHours: 6,
        weeklyMaxHours: 36,
        sessionDurationMinutes: 75,
        bufferPercent: 20,
        commitments: '',
        timezone: 'Asia/Tehran'
      };
    }
  }

  async init() {
    await this.db.init();
    await this.reloadStateFromDB();

    const todayJ = JalaliDateEngine.todayJalali();
    const dateEl = document.getElementById('header-jalali-date');
    if (dateEl) dateEl.textContent = JalaliDateEngine.toReadablePersianDate(todayJ);
    const statToday = document.getElementById('stat-today-date');
    if (statToday) statToday.textContent = JalaliDateEngine.toPersianDigits(todayJ);

    this.sound.init();
    this.pomodoro.init();
    this.populateSettingsForm();
    this.updateAIStatusIndicator();
    this.navigate('dashboard');
    this.syncWithLANServer(true);
  }

  async reloadStateFromDB() {
    this.state.semesters = await this.db.getAll('semesters');
    this.state.courses = await this.db.getAll('courses');
    this.state.resources = await this.db.getAll('resources');
    this.state.tasks = await this.db.getAll('tasks');
    this.state.assessments = await this.db.getAll('assessments');
    this.state.mastery = await this.db.getAll('mastery');
    this.state.forest = await this.db.getAll('forest');
    this.state.chatHistory = await this.db.getAll('chat_history');
    this.state.chatHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
      success: 'bg-emerald-800 text-white border-emerald-600',
      error: 'bg-rose-800 text-white border-rose-600',
      warning: 'bg-amber-700 text-white border-amber-500',
      info: 'bg-slate-800 text-white border-slate-600'
    };
    const el = document.createElement('div');
    el.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center justify-between gap-3 transition-all ${colors[type] || colors.info}`;
    el.innerHTML = `<span>${this.escapeHTML(message)}</span><button class="font-bold text-sm opacity-80 hover:opacity-100" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(el);
    setTimeout(() => { if (el.parentElement) el.remove(); }, 5000);
  }

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  navigate(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.nav === viewName) {
        btn.classList.add('border-amber-400', 'text-amber-300', 'bg-brand-800');
        btn.classList.remove('border-transparent');
      } else {
        btn.classList.remove('border-amber-400', 'text-amber-300', 'bg-brand-800');
        btn.classList.add('border-transparent');
      }
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    this.populateSharedCourseDropdowns();
    if (this.currentView === 'dashboard') this.renderDashboard();
    if (this.currentView === 'advisor') this.renderAdvisorWorkspace();
    if (this.currentView === 'courses') this.renderCoursesView();
    if (this.currentView === 'resources') this.renderResourcesView();
    if (this.currentView === 'calendar') this.renderCalendarView();
    if (this.currentView === 'tasks') this.renderTasksView();
    if (this.currentView === 'assessments') this.renderAssessmentsView();
    if (this.currentView === 'exports') this.refreshExportPreview();
    if (this.currentView === 'settings') this.populateSettingsForm();
  }

  populateSharedCourseDropdowns() {
    const selects = ['res-course', 'filter-task-course', 'assess-course', 'export-course-id', 'tm-course'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const prevVal = el.value;
      const isFilter = id === 'filter-task-course';
      el.innerHTML = isFilter ? '<option value="all">همه دروس</option>' : '';
      if (!isFilter && this.state.courses.length === 0) {
        el.innerHTML = '<option value="">ابتدا یک درس ثبت کنید</option>';
        return;
      }
      this.state.courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        el.appendChild(opt);
      });
      if (prevVal && Array.from(el.options).some(o => o.value === prevVal)) {
        el.value = prevVal;
      }
    });
  }

  /***********************************************************************
   * رندر پیشخوان (داشبورد)
   ***********************************************************************/
  renderDashboard() {
    this.renderForestView();
    const todayJ = JalaliDateEngine.todayJalali();
    const isEmpty = this.state.courses.length === 0 && this.state.tasks.length === 0;
    const emptyBanner = document.getElementById('dashboard-empty-banner');
    if (emptyBanner) {
      if (isEmpty) emptyBanner.classList.remove('hidden');
      else emptyBanner.classList.add('hidden');
    }

    const todayTasks = this.state.tasks.filter(t => t.date === todayJ);
    const todayCompleted = todayTasks.filter(t => t.status === 'completed').length;
    const todayMinutes = todayTasks.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);
    document.getElementById('stat-today-tasks').textContent = `${JalaliDateEngine.toPersianDigits(todayCompleted)} از ${JalaliDateEngine.toPersianDigits(todayTasks.length)}`;
    document.getElementById('stat-today-hours').textContent = `${JalaliDateEngine.toPersianDigits((todayMinutes / 60).toFixed(1))} ساعت برنامه‌ریزی‌شده امروز`;

    const weekStartJ = JalaliDateEngine.addDaysJalali(todayJ, -6);
    const weekTasks = this.state.tasks.filter(t =>
      JalaliDateEngine.diffDaysJalali(weekStartJ, t.date) >= 0 &&
      JalaliDateEngine.diffDaysJalali(t.date, JalaliDateEngine.addDaysJalali(todayJ, 6)) >= 0
    );
    const plannedWeekHours = weekTasks.reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0) / 60;
    const actualWeekHours = weekTasks.reduce((a, t) => a + (Number(t.actualDurationMinutes) || (t.status === 'completed' ? Number(t.durationMinutes) : 0)), 0) / 60;
    const weekRatio = plannedWeekHours > 0 ? Math.min(100, Math.round((actualWeekHours / plannedWeekHours) * 100)) : 0;

    document.getElementById('stat-weekly-hours').textContent = `${JalaliDateEngine.toPersianDigits(actualWeekHours.toFixed(1))} / ${JalaliDateEngine.toPersianDigits(plannedWeekHours.toFixed(1))} ساعت`;
    document.getElementById('stat-weekly-ratio').textContent = `${JalaliDateEngine.toPersianDigits(weekRatio)}٪ تحقق`;
    document.getElementById('stat-weekly-bar').style.width = `${weekRatio}%`;

    let totalPagesAll = 0;
    let completedPagesAll = 0;
    this.state.resources.forEach(r => {
      const assigned = DeterministicScheduler.calculateAssignedPages(r.assignedRanges, r.totalPages);
      totalPagesAll += assigned;
      completedPagesAll += Math.min(assigned, Number(r.completedPages) || 0);
    });
    const pagePct = totalPagesAll > 0 ? Math.round((completedPagesAll / totalPagesAll) * 100) : 0;
    document.getElementById('stat-resources-count').textContent = `${JalaliDateEngine.toPersianDigits(this.state.resources.length)} منبع ثبت‌شده`;
    document.getElementById('stat-pages-progress').textContent = `${JalaliDateEngine.toPersianDigits(pagePct)}٪`;
    document.getElementById('stat-pages-detail').textContent = `${JalaliDateEngine.toPersianDigits(completedPagesAll)} از ${JalaliDateEngine.toPersianDigits(totalPagesAll)} صفحه مطالعه‌شده`;

    const overdueTasks = this.state.tasks.filter(t =>
      (t.status === 'missed') ||
      (t.status === 'pending' && JalaliDateEngine.diffDaysJalali(t.date, todayJ) > 0)
    );
    document.getElementById('stat-overdue-count').textContent = `${JalaliDateEngine.toPersianDigits(overdueTasks.length)} مورد`;
    document.getElementById('stat-capacity-status').textContent = overdueTasks.length > 0
      ? 'نیازمند اجرای بازبرنامه‌ریزی تطبیقی'
      : `سقف هفتگی: ${JalaliDateEngine.toPersianDigits(this.state.preferences.weeklyMaxHours)} ساعت`;

    const todayListEl = document.getElementById('dashboard-today-list');
    if (todayTasks.length === 0) {
      todayListEl.innerHTML = `<div class="py-6 text-center text-xs text-slate-500">برای امروز (${JalaliDateEngine.toReadablePersianDate(todayJ)}) هنوز جلسه مطالعه‌ای ثبت نشده است. دکمه «تولید / بازنگری برنامه مطالعه» را بزنید.</div>`;
    } else {
      todayListEl.innerHTML = todayTasks.map(t => this.renderTaskCompactRow(t)).join('');
    }

    const coursesEl = document.getElementById('dashboard-courses-readiness');
    if (this.state.courses.length === 0) {
      coursesEl.innerHTML = `<div class="py-6 text-center text-xs text-slate-500">هیچ درسی ثبت نشده است.</div>`;
    } else {
      coursesEl.innerHTML = this.state.courses.map(c => this.renderCourseReadinessCard(c)).join('');
    }

    const examsEl = document.getElementById('dashboard-upcoming-exams');
    const coursesWithExams = this.state.courses
      .filter(c => c.examDate && c.examDate !== 'ندارد')
      .sort((a, b) => {
        const aValid = JalaliDateEngine.isValidJalaliString(a.examDate);
        const bValid = JalaliDateEngine.isValidJalaliString(b.examDate);
        if (aValid && bValid) return JalaliDateEngine.diffDaysJalali(b.examDate, a.examDate);
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return 0;
      });
    if (coursesWithExams.length === 0) {
      examsEl.innerHTML = `<p class="text-slate-400 text-center py-3">تاریخ امتحانی ثبت نشده است.</p>`;
    } else {
      examsEl.innerHTML = coursesWithExams.map(c => {
        const isValidDate = JalaliDateEngine.isValidJalaliString(c.examDate);
        if (!isValidDate) {
          return `
            <div class="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-800">${this.escapeHTML(c.name)}</div>
                <div class="text-[11px] text-amber-800">تاریخ امتحان هنوز توسط استاد تعیین نشده است</div>
              </div>
              <span class="px-2 py-1 rounded font-bold text-[11px] bg-amber-50 text-amber-800 border border-amber-300">
                نامشخص
              </span>
            </div>
          `;
        }
        const remDays = JalaliDateEngine.diffDaysJalali(todayJ, c.examDate);
        const badgeColor = remDays <= 7 ? 'bg-rose-100 text-rose-800' : (remDays <= 20 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800');
        return `
          <div class="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-800">${this.escapeHTML(c.name)}</div>
              <div class="text-[11px] text-slate-500">${JalaliDateEngine.toReadablePersianDate(c.examDate)} | ساعت ${JalaliDateEngine.toPersianDigits(c.examTime || '09:00')}</div>
            </div>
            <span class="px-2 py-1 rounded font-bold text-[11px] ${badgeColor}">
              ${remDays >= 0 ? `${JalaliDateEngine.toPersianDigits(remDays)} روز مانده` : 'برگزار شده'}
            </span>
          </div>
        `;
      }).join('');
    }

    const classesEl = document.getElementById('dashboard-weekly-classes');
    const coursesWithClasses = this.state.courses.filter(c => c.classDay);
    if (coursesWithClasses.length === 0) {
      classesEl.innerHTML = `<p class="text-slate-400 text-center py-3">برنامه کلاسی ثبت نشده است.</p>`;
    } else {
      classesEl.innerHTML = coursesWithClasses.map(c => {
        if (c.classDay === 'نامشخص') {
          return `
            <div class="flex items-center justify-between p-2 rounded bg-amber-50/60 border border-amber-100">
              <span class="font-semibold text-slate-800">${this.escapeHTML(c.name)}</span>
              <span class="text-amber-800 font-medium text-xs">نامشخص / در انتظار هماهنگی استاد</span>
            </div>
          `;
        }
        return `
          <div class="flex items-center justify-between p-2 rounded bg-indigo-50/60 border border-indigo-100">
            <span class="font-semibold text-slate-800">${this.escapeHTML(c.name)}</span>
            <span class="text-indigo-800 font-medium">${this.escapeHTML(c.classDay)} ${JalaliDateEngine.toPersianDigits(c.classStartTime)} تا ${JalaliDateEngine.toPersianDigits(c.classEndTime)}</span>
          </div>
        `;
      }).join('');
    }

    const weakEl = document.getElementById('dashboard-weak-topics');
    const weakList = this.state.mastery.filter(m => m.masteryLevel < 75);
    if (weakList.length === 0) {
      weakEl.innerHTML = `<p class="text-slate-400 text-center py-3">مبحث ضعیف ثبت نشده است. با ثبت آزمون‌های آزمایشی، نقاط ضعف پایش می‌شوند.</p>`;
    } else {
      weakEl.innerHTML = weakList.map(m => {
        const crs = this.state.courses.find(c => c.id === m.courseId);
        return `
          <div class="p-2 rounded bg-rose-50 border border-rose-200 flex items-center justify-between">
            <div>
              <div class="font-semibold text-rose-900">${this.escapeHTML(m.topic)}</div>
              <div class="text-[10px] text-rose-700">${crs ? this.escapeHTML(crs.name) : ''} | تسلط: ${JalaliDateEngine.toPersianDigits(m.masteryLevel)}٪</div>
            </div>
            <button onclick="app.quickAddSpacedReviewTask('${m.courseId}', '${this.escapeHTML(m.topic)}')" class="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-medium px-2 py-1 rounded shadow-sm">
              زمانبندی مرور
            </button>
          </div>
        `;
      }).join('');
    }
  }

  renderTaskCompactRow(t) {
    const crs = this.state.courses.find(c => c.id === t.courseId);
    const statusBadges = {
      pending: '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">در انتظار</span>',
      completed: '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold">تکمیل کامل</span>',
      partial: '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold">تکمیل جزئی</span>',
      missed: '<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-semibold">عقب‌افتاده</span>',
      cancelled: '<span class="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">لغو / تعلیق</span>'
    };

    return `
      <div class="py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-slate-800">${this.escapeHTML(t.title)}</span>
            ${statusBadges[t.status] || ''}
          </div>
          <div class="text-[11px] text-slate-500 flex items-center gap-2">
            <span class="text-brand-700 font-medium">${crs ? this.escapeHTML(crs.name) : ''}</span>
            <span>•</span>
            <span>${JalaliDateEngine.toPersianDigits(t.startTime)} تا ${JalaliDateEngine.toPersianDigits(t.endTime)} (${JalaliDateEngine.toPersianDigits(t.durationMinutes)} دقیقه)</span>
            ${t.pagesTargetCount > 0 ? `<span>• هدف: ${JalaliDateEngine.toPersianDigits(t.pagesTargetCount)} صفحه</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1.5 text-xs">
          <button onclick="app.openPomodoroModal('${t.id}')" title="شروع نشست با تایمر پومودورو" class="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded transition text-[11px] flex items-center gap-1">
            <span>⏱️</span>
            <span>پومودورو</span>
          </button>
          <button onclick="app.quickToggleTaskStatus('${t.id}', 'completed')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded transition text-[11px]">
            تکمیل
          </button>
          <button onclick="app.openEditTaskModal('${t.id}')" class="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded transition text-[11px]">
            ثبت جزئیات
          </button>
        </div>
      </div>
    `;
  }

  renderCourseReadinessCard(c) {
    const courseRes = this.state.resources.filter(r => r.courseId === c.id);
    let totalAssigned = 0;
    let completedPages = 0;
    courseRes.forEach(r => {
      const assigned = DeterministicScheduler.calculateAssignedPages(r.assignedRanges, r.totalPages);
      totalAssigned += assigned;
      completedPages += Math.min(assigned, Number(r.completedPages) || 0);
    });
    const pagePct = totalAssigned > 0 ? Math.round((completedPages / totalAssigned) * 100) : 0;

    const courseAssessments = this.state.assessments.filter(a => a.courseId === c.id);
    let avgScore = 0;
    if (courseAssessments.length > 0) {
      avgScore = courseAssessments.reduce((sum, a) => sum + Number(a.score), 0) / courseAssessments.length;
    }

    // شاخص آمادگی شفاف: ۴۰٪ پوشش منابع + ۴۰٪ نمرات آزمون‌ها + ۲۰٪ تسلط اولیه
    const testedRatio = courseAssessments.length > 0 ? (avgScore / 20) : (Number(c.initialMastery) / 100);
    const readinessIndex = Math.min(100, Math.round((pagePct * 0.4) + (testedRatio * 100 * 0.4) + ((Number(c.initialMastery) || 20) * 0.2)));

    let statusText = 'نیازمند شروع مطالعه و ورود آزمون‌های آزمایشی';
    let statusClass = 'text-slate-600';
    if (readinessIndex >= 85) {
      statusText = 'آمادگی در محدوده هدف (۱۸ تا ۲۰) - مشروط به تداوم مرور';
      statusClass = 'text-emerald-700 font-bold';
    } else if (readinessIndex >= 65) {
      statusText = 'در مسیر پیشرفت مطلوب - نیازمند تعمیق نقد منبع و آزمون زمان‌دار';
      statusClass = 'text-sky-700 font-medium';
    } else if (readinessIndex >= 40) {
      statusText = 'آمادگی متوسط - نیازمند افزایش ساعت مطالعه هفتگی';
      statusClass = 'text-amber-700 font-medium';
    }

    return `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="font-bold text-slate-900 text-sm">${this.escapeHTML(c.name)}</span>
            <span class="text-xs text-slate-500 mr-2">(${JalaliDateEngine.toPersianDigits(c.units)} واحد | نمره هدف: ${JalaliDateEngine.toPersianDigits(c.targetGrade)} از ۲۰)</span>
          </div>
          <span class="text-xs ${statusClass}">${statusText}</span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs text-slate-600">
          <div>پوشش صفحات: <strong class="text-slate-900">${JalaliDateEngine.toPersianDigits(completedPages)} از ${JalaliDateEngine.toPersianDigits(totalAssigned)} (${JalaliDateEngine.toPersianDigits(pagePct)}٪)</strong></div>
          <div>میانگین آزمون‌ها: <strong class="text-slate-900">${courseAssessments.length > 0 ? `${JalaliDateEngine.toPersianDigits(avgScore.toFixed(1))} از ۲۰ (${JalaliDateEngine.toPersianDigits(courseAssessments.length)} آزمون)` : 'بدون آزمون'}</strong></div>
          <div>شاخص شفاف آمادگی: <strong class="text-brand-700">${JalaliDateEngine.toPersianDigits(readinessIndex)}٪</strong></div>
        </div>

        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-persian-turquoise h-full transition-all" style="width: ${readinessIndex}%"></div>
        </div>
      </div>
    `;
  }

  /***********************************************************************
   * رندر مشاور هوشمند (Conversational AI Workspace)
   ***********************************************************************/
  renderAdvisorWorkspace() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (this.state.chatHistory.length === 0) {
      container.innerHTML = `
        <div class="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl">
            مشاور
          </div>
          <h3 class="font-bold text-slate-900 text-sm md:text-base">میز مشاوره تخصصی تاریخ ایران در دوره اسلامی</h3>
          <p class="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
            سلام! من مشاور تحصیلی شما هستم. می‌توانید مشخصات دروس ترم جدید، کتاب‌ها، زمان کلاس‌ها و تاریخ امتحانات خود را به فارسی بنویسید تا آن را به برنامه عملیاتی منظم تبدیل کنم.
          </p>
          <button onclick="app.insertSamplePrompt()" class="text-xs bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-300 px-3 py-1.5 rounded-lg transition font-medium">
            درج نمونه ورودی استاندارد
          </button>
        </div>
      `;
    } else {
      container.innerHTML = this.state.chatHistory.map(msg => {
        const isUser = msg.role === 'user';
        return `
          <div class="flex flex-col ${isUser ? 'items-start' : 'items-end'} space-y-1">
            <span class="text-[10px] text-slate-400 px-1">${isUser ? 'شما (دانشجو)' : 'مشاور هوشمند'}</span>
            <div class="p-3.5 rounded-2xl text-xs md:text-sm max-w-[85%] leading-relaxed ${isUser ? 'bg-brand-700 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'}">
              ${this.escapeHTML(msg.text).replace(/\n/g, '<br/>')}
              ${msg.apiErrorWarning ? `<div class="mt-2 p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded text-xs">${this.escapeHTML(msg.apiErrorWarning)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      container.scrollTop = container.scrollHeight;
    }

    this.renderAdvisorProposals();
  }

  renderAdvisorProposals() {
    const container = document.getElementById('advisor-proposals-container');
    const badge = document.getElementById('badge-pending-proposals');
    if (!container) return;

    if (badge) {
      badge.textContent = JalaliDateEngine.toPersianDigits(this.state.pendingProposals.length);
      if (this.state.pendingProposals.length > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    if (this.state.pendingProposals.length === 0) {
      container.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">در حال حاضر هیچ پیش‌نویس تاییدنشده‌ای وجود ندارد.</p>`;
      return;
    }

    const batchApproveHeader = this.state.pendingProposals.length > 1 ? `
      <div class="mb-3">
        <button onclick="app.approveAllProposals()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-sm transition flex items-center justify-center gap-1.5">
          <span>✓ تایید و ثبت همزمان همه پیش‌نویس‌ها (${JalaliDateEngine.toPersianDigits(this.state.pendingProposals.length)} مورد)</span>
        </button>
      </div>
    ` : '';

    container.innerHTML = batchApproveHeader + this.state.pendingProposals.map((prop, idx) => {
      const isCourse = prop.type === 'course';
      return `
        <div class="p-3 rounded-lg border border-slate-300 bg-white shadow-sm space-y-2 text-xs">
          <div class="flex items-center justify-between border-b pb-1.5">
            <span class="font-bold text-brand-800">${isCourse ? 'پیش‌نویس درس' : 'پیش‌نویس منبع مطالعاتی'}</span>
            <span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">در انتظار تایید</span>
          </div>
          ${isCourse ? `
            <div class="space-y-1">
              <div>نام درس: <input type="text" value="${this.escapeHTML(prop.data.name)}" onchange="app.updateProposalField(${idx}, 'name', this.value)" class="border rounded px-1.5 py-0.5 w-full font-semibold" /></div>
              ${prop.data.instructor ? `<div class="text-[11px] text-slate-600">استاد: <input type="text" value="${this.escapeHTML(prop.data.instructor)}" onchange="app.updateProposalField(${idx}, 'instructor', this.value)" class="border rounded px-1 py-0.5 w-3/4" /></div>` : ''}
              <div class="grid grid-cols-2 gap-1 text-[11px]">
                <div>واحد: <input type="number" value="${prop.data.units || 2}" onchange="app.updateProposalField(${idx}, 'units', this.value)" class="border rounded px-1 py-0.5 w-14" /></div>
                <div>کلاس: ${this.escapeHTML(prop.data.classDay || 'تعیین نشده')} ${JalaliDateEngine.toPersianDigits(prop.data.classStartTime || '')}</div>
              </div>
              <div class="text-[11px]">امتحان: <input type="text" value="${prop.data.examDate}" onchange="app.updateProposalField(${idx}, 'examDate', this.value)" class="border rounded px-1 py-0.5 w-28 ltr-inline text-center" /></div>
            </div>
          ` : `
            <div class="space-y-1">
              <div>عنوان: <input type="text" value="${this.escapeHTML(prop.data.title)}" onchange="app.updateProposalField(${idx}, 'title', this.value)" class="border rounded px-1.5 py-0.5 w-full font-semibold" /></div>
              <div class="text-[11px]">درس مرتبط: <strong>${this.escapeHTML(prop.data.courseName || '')}</strong></div>
              <div class="text-[11px]">حجم (صفحه): <input type="number" value="${prop.data.totalPages || 0}" onchange="app.updateProposalField(${idx}, 'totalPages', this.value)" class="border rounded px-1 py-0.5 w-20" /></div>
            </div>
          `}
          <div class="flex justify-end gap-1.5 pt-1">
            <button onclick="app.rejectProposal(${idx})" class="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded text-[11px]">رد</button>
            <button onclick="app.approveProposal(${idx})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded font-semibold text-[11px] shadow-sm">تایید و ثبت در پایگاه داده</button>
          </div>
        </div>
      `;
    }).join('');
  }

  updateProposalField(idx, field, value) {
    if (this.state.pendingProposals[idx]) {
      this.state.pendingProposals[idx].data[field] = value;
    }
  }

  async approveAllProposals() {
    if (this.state.pendingProposals.length === 0) return;
    const total = this.state.pendingProposals.length;
    while (this.state.pendingProposals.length > 0) {
      await this.approveProposal(0);
    }
    this.showToast(`تمامی ${JalaliDateEngine.toPersianDigits(total)} پیش‌نویس با موفقیت تایید و در پایگاه داده ذخیره شدند.`, 'success');
  }

  async handleChatSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const text = (input?.value || '').trim();
    if (!text) return;

    input.value = '';
    const userMsg = {
      id: `chat_${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now()
    };
    this.state.chatHistory.push(userMsg);
    await this.db.put('chat_history', userMsg);
    this.renderAdvisorWorkspace();

    const submitBtn = document.getElementById('chat-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>در حال تحلیل هوشمند...</span>`;
    }

    try {
      const todayJ = JalaliDateEngine.todayJalali();
      const compactContext = {
        todayJalali: todayJ,
        coursesSummary: this.state.courses.map(c => ({
          id: c.id,
          name: c.name,
          instructor: c.instructor,
          units: c.units,
          classDay: c.classDay,
          classStartTime: c.classStartTime,
          classEndTime: c.classEndTime,
          examDate: c.examDate
        })),
        pendingProposalsSummary: this.state.pendingProposals.map(p => ({
          type: p.type,
          name: p.data?.name || p.data?.title,
          instructor: p.data?.instructor,
          units: p.data?.units,
          classDay: p.data?.classDay,
          examDate: p.data?.examDate
        }))
      };

      const previousHistory = this.state.chatHistory.slice(0, -1);
      const result = await this.ai.analyzeStudentMessage(text, compactContext, previousHistory);

      const aiMsg = {
        id: `chat_${Date.now()}_ai`,
        role: 'assistant',
        text: result.replyText,
        epistemicBreakdown: result.epistemicBreakdown,
        apiErrorWarning: result.apiErrorWarning || null,
        rawJson: result.rawJson || null,
        proposedCourses: result.proposedCourses || [],
        proposedResources: result.proposedResources || [],
        timestamp: Date.now()
      };
      this.state.chatHistory.push(aiMsg);
      await this.db.put('chat_history', aiMsg);

      if (Array.isArray(result.proposedCourses)) {
        result.proposedCourses.forEach(c => {
          const cleanName = (c.name || '').trim();
          if (!cleanName) return;
          const existIdx = this.state.pendingProposals.findIndex(p =>
            p.type === 'course' && (
              p.data.name.trim() === cleanName ||
              p.data.name.includes(cleanName) ||
              cleanName.includes(p.data.name)
            )
          );
          if (existIdx >= 0) {
            this.state.pendingProposals[existIdx].data = {
              ...this.state.pendingProposals[existIdx].data,
              ...c
            };
          } else {
            this.state.pendingProposals.push({ type: 'course', data: c });
          }
        });
      }
      if (Array.isArray(result.proposedResources)) {
        result.proposedResources.forEach(r => {
          const cleanTitle = (r.title || '').trim();
          if (!cleanTitle) return;
          const existIdx = this.state.pendingProposals.findIndex(p =>
            p.type === 'resource' && p.data.title.trim() === cleanTitle
          );
          if (existIdx >= 0) {
            this.state.pendingProposals[existIdx].data = {
              ...this.state.pendingProposals[existIdx].data,
              ...r
            };
          } else {
            this.state.pendingProposals.push({ type: 'resource', data: r });
          }
        });
      }

      this.showToast('پاسخ مشاور آماده شد و پیش‌نویس‌ها در ستون کناری قرار گرفتند.', 'success');
    } catch (err) {
      this.showToast(`خطا: ${err.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>ارسال و تحلیل هوشمند</span>`;
      }
      this.renderAdvisorWorkspace();
    }
  }

  insertSamplePrompt() {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = 'این ترم چهار درس دارم. تاریخ صفویه دو واحد است. کلاس آن سه‌شنبه از ساعت ۱۰ تا ۱۲ برگزار می‌شود. امتحانش ۲۵ دی است. منبع اصلی کتاب ایران عصر صفوی ساوری است و باید حدود ۳۰۰ صفحه بخوانم.';
      input.focus();
    }
  }

  async clearChatHistoryPrompt() {
    if (confirm('آیا مایلید تاریخچه گفتگو با مشاور پاکسازی شود؟ (اطلاعات دروس و منابع ذخیره‌شده پاک نمی‌شوند)')) {
      await this.db.clearStore('chat_history');
      this.state.chatHistory = [];
      this.renderAdvisorWorkspace();
      this.showToast('تاریخچه گفتگو پاک شد.', 'info');
    }
  }

  async approveProposal(idx) {
    const prop = this.state.pendingProposals[idx];
    if (!prop) return;

    if (prop.type === 'course') {
      const sem = this.state.semesters[0]?.id || 'sem_default';
      const newCourse = {
        id: `course_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        semesterId: sem,
        name: prop.data.name,
        code: prop.data.code || '',
        units: Number(prop.data.units) || 2,
        instructor: prop.data.instructor || '',
        classDay: JalaliDateEngine.normalizeWeekday(prop.data.classDay || ''),
        classStartTime: prop.data.classStartTime || '10:00',
        classEndTime: prop.data.classEndTime || '12:00',
        examDate: prop.data.examDate || 'نامشخص',
        examTime: prop.data.examTime || '09:00',
        examFormat: prop.data.examFormat || 'essay_analytical',
        targetGrade: Number(prop.data.targetGrade) || 19,
        difficulty: Number(prop.data.difficulty) || 3,
        initialMastery: Number(prop.data.initialMastery) || 20,
        weightsUnknown: prop.data.weightsUnknown || false,
        weightFinal: 14,
        weightPaper: 4,
        weightClass: 2,
        assignmentDate: '',
        requirements: '',
        pendingNotes: prop.data.pendingNotes || '',
        createdAt: new Date().toISOString()
      };
      await this.db.put('courses', newCourse);
      this.state.courses.push(newCourse);
      this.showToast(`درس «${newCourse.name}» با موفقیت ذخیره شد.`, 'success');
    } else if (prop.type === 'resource') {
      let matchedCourse = this.state.courses.find(c => c.name === prop.data.courseName) || this.state.courses[0];
      const newResource = {
        id: `res_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        courseId: matchedCourse ? matchedCourse.id : '',
        title: prop.data.title,
        author: prop.data.author || '',
        type: 'book',
        isRequired: 'required',
        totalPages: Number(prop.data.totalPages) || 0,
        assignedRanges: prop.data.assignedRanges || (prop.data.totalPages ? `1-${prop.data.totalPages}` : 'نامشخص'),
        readingSpeedPagesPerHour: 15,
        completedPages: 0,
        currentPosition: '',
        importance: 'high',
        difficulty: 'normal',
        notes: prop.data.isEstimate ? 'حجم صفحات به صورت تخمینی توسط دانشجو ثبت شده است.' : '',
        pendingNotes: prop.data.pendingNotes || '',
        createdAt: new Date().toISOString()
      };
      await this.db.put('resources', newResource);
      this.state.resources.push(newResource);
      this.showToast(`منبع «${newResource.title}» با موفقیت ذخیره شد.`, 'success');
    }

    this.state.pendingProposals.splice(idx, 1);
    this.renderAdvisorProposals();
    this.populateSharedCourseDropdowns();
  }

  rejectProposal(idx) {
    this.state.pendingProposals.splice(idx, 1);
    this.renderAdvisorProposals();
  }

  /***********************************************************************
   * ۳. مدیریت دروس و نیمسال‌ها
   ***********************************************************************/
  renderCoursesView() {
    const semContainer = document.getElementById('semesters-list');
    const semSelect = document.getElementById('course-semester');
    if (semContainer) {
      if (this.state.semesters.length === 0) {
        semContainer.innerHTML = `<span class="text-xs text-slate-400">هنوز نیمسالی ثبت نشده است.</span>`;
      } else {
        semContainer.innerHTML = this.state.semesters.map(s => `
          <div class="px-3 py-1.5 bg-slate-100 rounded-lg text-xs flex items-center gap-2 border border-slate-200">
            <span class="font-bold text-slate-800">${this.escapeHTML(s.title)}</span>
            <span class="text-slate-500 font-mono">(${JalaliDateEngine.toPersianDigits(s.startDate)} تا ${JalaliDateEngine.toPersianDigits(s.endDate)})</span>
            <button onclick="app.deleteSemester('${s.id}')" class="text-rose-600 hover:text-rose-800 font-bold mr-1">&times;</button>
          </div>
        `).join('');
      }
    }

    if (semSelect) {
      if (this.state.semesters.length === 0) {
        semSelect.innerHTML = `<option value="sem_default">نیمسال جاری (پیش‌فرض / نامشخص)</option>`;
      } else {
        semSelect.innerHTML = this.state.semesters.map(s => `<option value="${s.id}">${this.escapeHTML(s.title)}</option>`).join('');
      }
    }

    const tableContainer = document.getElementById('courses-table-container');
    const totalUnitsBadge = document.getElementById('courses-total-units');
    const totalUnits = this.state.courses.reduce((sum, c) => sum + (Number(c.units) || 0), 0);
    if (totalUnitsBadge) totalUnitsBadge.textContent = `جمع واحدها: ${JalaliDateEngine.toPersianDigits(totalUnits)}`;

    if (!tableContainer) return;

    if (this.state.courses.length === 0) {
      tableContainer.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">درسی ثبت نشده است.</p>`;
      return;
    }

    tableContainer.innerHTML = `
      <table class="w-full text-right text-xs">
        <thead class="bg-slate-50 text-slate-700 font-bold border-b">
          <tr>
            <th class="p-2.5">نام درس</th>
            <th class="p-2.5">واحد</th>
            <th class="p-2.5">کلاس دانشگاه</th>
            <th class="p-2.5">امتحان پایانی</th>
            <th class="p-2.5">فرمت امتحان</th>
            <th class="p-2.5">نمره هدف</th>
            <th class="p-2.5 text-center">عملیات</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${this.state.courses.map(c => `
            <tr class="hover:bg-slate-50">
              <td class="p-2.5 font-bold text-slate-900">
                <div>${this.escapeHTML(c.name)} ${c.code ? `<span class="text-slate-400 text-[10px]">(${this.escapeHTML(c.code)})</span>` : ''}</div>
                ${c.pendingNotes ? `<div class="text-[10px] text-amber-900 font-normal mt-1 bg-amber-50/90 p-1.5 rounded border border-amber-200 max-w-md leading-relaxed">📌 ${this.escapeHTML(c.pendingNotes)}</div>` : ''}
              </td>
              <td class="p-2.5">${JalaliDateEngine.toPersianDigits(c.units)}</td>
              <td class="p-2.5">
                ${c.classDay === 'نامشخص'
                  ? '<span class="text-amber-700 font-medium">نامشخص / توافقی</span>'
                  : (c.classDay ? `${this.escapeHTML(c.classDay)} ${JalaliDateEngine.toPersianDigits(c.classStartTime)} - ${JalaliDateEngine.toPersianDigits(c.classEndTime)}` : '<span class="text-slate-400">بدون کلاس ثابت</span>')
                }
              </td>
              <td class="p-2.5">
                ${(c.examDate && c.examDate !== 'نامشخص' && JalaliDateEngine.isValidJalaliString(c.examDate))
                  ? `${JalaliDateEngine.toPersianDigits(c.examDate)} (ساعت ${JalaliDateEngine.toPersianDigits(c.examTime || '09:00')})`
                  : '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">در انتظار اعلام تاریخ</span>'
                }
              </td>
              <td class="p-2.5">${this.formatExamTypeName(c.examFormat)}</td>
              <td class="p-2.5 font-semibold text-brand-700">${c.targetGrade ? `${JalaliDateEngine.toPersianDigits(c.targetGrade)} از ۲۰` : 'تعیین‌نشده'}</td>
              <td class="p-2.5 text-center whitespace-nowrap">
                <button onclick="app.editCourse('${c.id}')" class="text-brand-600 hover:underline px-1.5 font-medium">ویرایش</button>
                <button onclick="app.deleteCourse('${c.id}')" class="text-rose-600 hover:underline px-1.5 font-medium">حذف</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  formatExamTypeName(format) {
    const map = {
      unknown: 'در انتظار اعلام استاد (نامشخص)',
      no_written_exam: 'بدون آزمون کتبی (پژوهش و سمینار)',
      essay_analytical: 'تشریحی تحلیلی',
      historiographical: 'نقد منبع و تاریخ‌نگارانه',
      research_paper: 'مقاله پژوهشی',
      factual_chronological: 'گاهشمار و وقایع‌نگاری',
      oral: 'شفاهی',
      mixed: 'ترکیبی'
    };
    return map[format] || format || 'نامشخص';
  }

  formatResourceTypeName(type) {
    const map = {
      book: 'کتاب و درسنامه',
      primary_source: 'منبع دست اول کهن',
      article: 'مقاله علمی پژوهشی',
      notes: 'جزوه و فیش تحلیلی',
      syllabus: 'سرفصل آموزشی',
      unknown: 'نامشخص / منبع مطالعاتی'
    };
    return map[type] || type || 'منبع مطالعاتی';
  }

  toggleWeightsUnknown(isChecked) {
    const inputs = ['weight-final', 'weight-paper', 'weight-class'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = isChecked;
        if (isChecked) el.classList.add('opacity-40', 'bg-slate-100');
        else el.classList.remove('opacity-40', 'bg-slate-100');
      }
    });
  }

  setSemesterPreset(term) {
    const todayJ = JalaliDateEngine.todayJalali();
    const currentYear = todayJ.split('/')[0];
    const nextYear = Number(currentYear) + 1;
    if (term === 'fall') {
      document.getElementById('sem-title').value = `نیمسال اول ${JalaliDateEngine.toPersianDigits(currentYear)}-${JalaliDateEngine.toPersianDigits(nextYear)}`;
      document.getElementById('sem-start').value = `${currentYear}/07/01`;
      document.getElementById('sem-end').value = `${currentYear}/11/15`;
    } else if (term === 'spring') {
      document.getElementById('sem-title').value = `نیمسال دوم ${JalaliDateEngine.toPersianDigits(currentYear)}-${JalaliDateEngine.toPersianDigits(nextYear)}`;
      document.getElementById('sem-start').value = `${currentYear}/11/16`;
      document.getElementById('sem-end').value = `${nextYear}/04/10`;
    }
    this.showToast('الگوی تاریخ نیمسال درج شد.', 'info');
  }

  async saveSemester(event) {
    event.preventDefault();
    const title = document.getElementById('sem-title').value.trim();
    const startDate = JalaliDateEngine.normalizeJalali(document.getElementById('sem-start').value.trim());
    let endDate = JalaliDateEngine.normalizeJalali(document.getElementById('sem-end').value.trim());

    if (!JalaliDateEngine.isValidJalaliString(startDate)) {
      this.showToast('تاریخ شروع نیمسال نامعتبر است (فرمت: 1405/07/01)', 'error');
      return;
    }

    if (!endDate || !JalaliDateEngine.isValidJalaliString(endDate)) {
      endDate = JalaliDateEngine.addDaysJalali(startDate, 120); // تخمین ۴ ماهه در صورت عدم اطلاع دقیق
    }

    const semId = document.getElementById('sem-id').value || `sem_${Date.now()}`;
    const semObj = { id: semId, title, startDate, endDate };
    await this.db.put('semesters', semObj);

    const existIdx = this.state.semesters.findIndex(s => s.id === semId);
    if (existIdx >= 0) this.state.semesters[existIdx] = semObj;
    else this.state.semesters.push(semObj);

    document.getElementById('sem-id').value = '';
    document.getElementById('sem-title').value = '';
    this.showToast('نیمسال با موفقیت ذخیره شد.', 'success');
    this.renderCoursesView();
  }

  async deleteSemester(id) {
    if (confirm('آیا از حذف این نیمسال اطمینان دارید؟')) {
      await this.db.delete('semesters', id);
      this.state.semesters = this.state.semesters.filter(s => s.id !== id);
      this.renderCoursesView();
      this.showToast('نیمسال حذف شد.', 'info');
    }
  }

  async saveCourse(event) {
    event.preventDefault();
    const id = document.getElementById('course-id').value || `course_${Date.now()}`;
    const name = document.getElementById('course-name').value.trim();
    const code = document.getElementById('course-code').value.trim();
    const semesterId = document.getElementById('course-semester').value || 'sem_default';
    const units = Number(document.getElementById('course-units').value) || 2;
    const instructor = document.getElementById('course-instructor').value.trim();
    const rawClassDay = document.getElementById('course-class-day').value;
    const classDay = (rawClassDay && rawClassDay !== 'نامشخص') ? JalaliDateEngine.normalizeWeekday(rawClassDay) : rawClassDay;
    const classStartTime = document.getElementById('course-class-start').value;
    const classEndTime = document.getElementById('course-class-end').value;

    const rawExamDate = document.getElementById('course-exam-date').value.trim();
    let examDate = 'نامشخص';
    if (rawExamDate && rawExamDate !== 'نامشخص' && rawExamDate !== 'ندارد') {
      if (JalaliDateEngine.isValidJalaliString(rawExamDate)) {
        examDate = JalaliDateEngine.normalizeJalali(rawExamDate);
      } else {
        this.showToast('فرمت تاریخ امتحان نامعتبر است (مثال: 1405/10/25 یا نامشخص یا ندارد)', 'error');
        return;
      }
    } else if (rawExamDate === 'ندارد') {
      examDate = 'ندارد';
    }

    const examTime = document.getElementById('course-exam-time').value;
    const examFormat = document.getElementById('course-exam-format').value;
    const targetGrade = Number(document.getElementById('course-target-grade').value) || 19;
    const difficulty = Number(document.getElementById('course-difficulty').value) || 0;
    const initialMastery = Number(document.getElementById('course-mastery').value) || 20;

    const weightsUnknown = document.getElementById('weights-unknown')?.checked || false;
    let weightFinal = weightsUnknown ? null : (Number(document.getElementById('weight-final').value) || 0);
    let weightPaper = weightsUnknown ? null : (Number(document.getElementById('weight-paper').value) || 0);
    let weightClass = weightsUnknown ? null : (Number(document.getElementById('weight-class').value) || 0);

    if (!weightsUnknown && (weightFinal + weightPaper + weightClass > 20)) {
      this.showToast('مجموع بارم‌بندی نمی‌تواند بیش از ۲۰ نمره باشد.', 'error');
      return;
    }

    const pendingNotes = document.getElementById('course-pending-notes')?.value.trim() || '';

    // تداخل‌سنجی کلاس با سایر دروس در همان روز
    if (classDay && classDay !== 'نامشخص') {
      const conflictCourse = this.state.courses.find(c =>
        c.id !== id &&
        c.classDay &&
        c.classDay === classDay &&
        DeterministicScheduler.isTimeOverlapping(classStartTime, classEndTime, c.classStartTime, c.classEndTime)
      );

      if (conflictCourse) {
        const warnEl = document.getElementById('course-conflict-warning');
        warnEl.textContent = `هشدار تداخل کلاسی: این ساعت با کلاس درس «${conflictCourse.name}» در روز ${classDay} همپوشانی دارد. لطفاً برنامه را بررسی کنید.`;
        warnEl.classList.remove('hidden');
      }
    }

    const courseObj = {
      id, name, code, semesterId, units, instructor, classDay, classStartTime, classEndTime,
      examDate, examTime, examFormat, targetGrade, difficulty, initialMastery,
      weightsUnknown, weightFinal, weightPaper, weightClass,
      assignmentDate: document.getElementById('course-assignment-date').value.trim(),
      requirements: document.getElementById('course-requirements').value.trim(),
      pendingNotes,
      updatedAt: new Date().toISOString()
    };

    await this.db.put('courses', courseObj);
    const existIdx = this.state.courses.findIndex(c => c.id === id);
    if (existIdx >= 0) this.state.courses[existIdx] = courseObj;
    else this.state.courses.push(courseObj);

    this.resetCourseForm();
    this.showToast(`درس «${name}» با موفقیت ذخیره شد.`, 'success');
    this.renderCoursesView();
    this.populateSharedCourseDropdowns();
  }

  editCourse(id) {
    const c = this.state.courses.find(item => item.id === id);
    if (!c) return;
    document.getElementById('course-id').value = c.id;
    document.getElementById('course-name').value = c.name;
    document.getElementById('course-code').value = c.code || '';
    document.getElementById('course-semester').value = c.semesterId || '';
    document.getElementById('course-units').value = c.units;
    document.getElementById('course-instructor').value = c.instructor || '';
    document.getElementById('course-class-day').value = c.classDay ? JalaliDateEngine.normalizeWeekday(c.classDay) : '';
    document.getElementById('course-class-start').value = c.classStartTime || '10:00';
    document.getElementById('course-class-end').value = c.classEndTime || '12:00';
    document.getElementById('course-exam-date').value = (c.examDate && c.examDate !== 'نامشخص') ? c.examDate : (c.examDate === 'نامشخص' ? 'نامشخص' : '');
    document.getElementById('course-exam-time').value = c.examTime || '09:00';
    document.getElementById('course-exam-format').value = c.examFormat || 'unknown';
    document.getElementById('course-target-grade').value = c.targetGrade || 19;
    document.getElementById('course-difficulty').value = c.difficulty ?? 3;
    document.getElementById('course-mastery').value = c.initialMastery || 20;

    const wUnknown = Boolean(c.weightsUnknown);
    const wUnkEl = document.getElementById('weights-unknown');
    if (wUnkEl) wUnkEl.checked = wUnknown;
    this.toggleWeightsUnknown(wUnknown);

    document.getElementById('weight-final').value = c.weightFinal ?? 14;
    document.getElementById('weight-paper').value = c.weightPaper ?? 4;
    document.getElementById('weight-class').value = c.weightClass ?? 2;
    document.getElementById('course-assignment-date').value = c.assignmentDate || '';
    document.getElementById('course-requirements').value = c.requirements || '';
    document.getElementById('course-pending-notes').value = c.pendingNotes || '';
    document.getElementById('course-form-title').textContent = `ویرایش درس: ${c.name}`;
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }

  async deleteCourse(id) {
    if (confirm('آیا از حذف این درس و تمامی منابع مرتبط با آن اطمینان دارید؟')) {
      await this.db.delete('courses', id);
      this.state.courses = this.state.courses.filter(c => c.id !== id);
      // حذف منابع مرتبط
      const relatedRes = this.state.resources.filter(r => r.courseId === id);
      for (const r of relatedRes) {
        await this.db.delete('resources', r.id);
      }
      this.state.resources = this.state.resources.filter(r => r.courseId !== id);

      this.renderCoursesView();
      this.populateSharedCourseDropdowns();
      this.showToast('درس حذف گردید.', 'info');
    }
  }

  resetCourseForm() {
    document.getElementById('course-id').value = '';
    document.getElementById('course-name').value = '';
    document.getElementById('course-code').value = '';
    document.getElementById('course-instructor').value = '';
    document.getElementById('course-exam-date').value = '';
    document.getElementById('course-requirements').value = '';
    document.getElementById('course-pending-notes').value = '';
    const wUnkEl = document.getElementById('weights-unknown');
    if (wUnkEl) wUnkEl.checked = false;
    this.toggleWeightsUnknown(false);
    document.getElementById('course-conflict-warning').classList.add('hidden');
    document.getElementById('course-form-title').textContent = 'افزودن درس جدید به نیمسال';
  }

  /***********************************************************************
   * ۴. مدیریت منابع و متون تاریخی
   ***********************************************************************/
  renderResourcesView() {
    const listContainer = document.getElementById('resources-list-container');
    const badge = document.getElementById('resources-summary-badge');
    if (!listContainer) return;

    if (badge) {
      badge.textContent = `${JalaliDateEngine.toPersianDigits(this.state.resources.length)} منبع فعال`;
    }

    if (this.state.resources.length === 0) {
      listContainer.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">منبع مطالعاتی ثبت نشده است.</p>`;
      return;
    }

    listContainer.innerHTML = this.state.resources.map(r => {
      const crs = this.state.courses.find(c => c.id === r.courseId);
      const assigned = DeterministicScheduler.calculateAssignedPages(r.assignedRanges, r.totalPages);
      const completed = Number(r.completedPages) || 0;
      const pct = assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : 0;

      const typeLabels = {
        book: 'کتاب',
        primary_source: 'منبع کهن / دست اول',
        article: 'مقاله',
        notes: 'جزوه / فیش',
        syllabus: 'سرفصل',
        unknown: 'نامشخص / در دست بررسی'
      };

      const isRangesUnknown = !r.assignedRanges || r.assignedRanges === 'نامشخص';

      return `
        <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <span class="font-bold text-slate-900 text-sm">${this.escapeHTML(r.title)}</span>
              ${r.author ? `<span class="text-slate-500 mr-2">(${this.escapeHTML(r.author)})</span>` : ''}
              <span class="mr-2 text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-medium">${crs ? this.escapeHTML(crs.name) : 'درس نامشخص'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${r.isRequired === 'required' ? 'bg-rose-50 text-rose-700 border border-rose-200' : (r.isRequired === 'unknown' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700')}">
                ${r.isRequired === 'required' ? 'منبع اصلی' : (r.isRequired === 'unknown' ? 'الزام نامشخص' : 'فرعی')}
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">${typeLabels[r.type] || r.type}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
            <div>بازه‌های صفحات: ${isRangesUnknown ? '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">در انتظار اعلام استاد</span>' : `<strong class="text-slate-900 ltr-inline font-mono">${this.escapeHTML(r.assignedRanges)}</strong>`}</div>
            <div>حجم تعیین‌شده: <strong class="text-slate-900">${assigned > 0 ? `${JalaliDateEngine.toPersianDigits(assigned)} صفحه` : 'نامشخص (مطالعه سرفصل‌ها)'}</strong></div>
            <div>مطالعه‌شده: <strong class="text-emerald-700">${JalaliDateEngine.toPersianDigits(completed)} صفحه (${JalaliDateEngine.toPersianDigits(pct)}٪)</strong></div>
            <div>سرعت مطالعه: <strong class="text-slate-900">${JalaliDateEngine.toPersianDigits(r.readingSpeedPagesPerHour || 15)} ص/ساعت</strong></div>
          </div>

          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div class="bg-brand-600 h-full transition-all" style="width: ${pct}%"></div>
          </div>

          ${r.pendingNotes ? `<div class="p-2 bg-amber-50/90 rounded text-amber-950 text-[11px] leading-relaxed border border-amber-200">📌 وضعیت و توضیحات نامشخص: ${this.escapeHTML(r.pendingNotes)}</div>` : ''}
          ${r.notes ? `<div class="p-2 bg-slate-50 rounded text-slate-600 text-[11px] leading-relaxed border border-slate-100">${this.escapeHTML(r.notes)}</div>` : ''}

          <div class="flex justify-end gap-2 pt-1">
            <button onclick="app.editResource('${r.id}')" class="text-brand-600 hover:underline font-medium">ویرایش</button>
            <button onclick="app.deleteResource('${r.id}')" class="text-rose-600 hover:underline font-medium">حذف</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async saveResource(event) {
    event.preventDefault();
    const id = document.getElementById('res-id').value || `res_${Date.now()}`;
    const courseId = document.getElementById('res-course').value;
    const title = document.getElementById('res-title').value.trim();
    const author = document.getElementById('res-author').value.trim();
    const type = document.getElementById('res-type').value;
    const isRequired = document.getElementById('res-required').value;
    const totalPages = Number(document.getElementById('res-total-pages').value) || 0;
    const rawRanges = document.getElementById('res-ranges').value.trim();
    const assignedRanges = rawRanges || 'نامشخص';
    const readingSpeedPagesPerHour = Number(document.getElementById('res-speed').value) || 15;
    const completedPages = Number(document.getElementById('res-completed-pages').value) || 0;
    const currentPosition = document.getElementById('res-position').value.trim();
    const importance = document.getElementById('res-importance').value;
    const difficulty = document.getElementById('res-difficulty').value;
    const notes = document.getElementById('res-notes').value.trim();
    const pendingNotes = document.getElementById('res-pending-notes')?.value.trim() || '';

    if (!courseId) {
      this.showToast('لطفاً ابتدا یک درس انتخاب کنید.', 'error');
      return;
    }

    const resObj = {
      id, courseId, title, author, type, isRequired, totalPages, assignedRanges,
      readingSpeedPagesPerHour, completedPages, currentPosition, importance, difficulty, notes,
      pendingNotes,
      updatedAt: new Date().toISOString()
    };

    await this.db.put('resources', resObj);
    const existIdx = this.state.resources.findIndex(r => r.id === id);
    if (existIdx >= 0) this.state.resources[existIdx] = resObj;
    else this.state.resources.push(resObj);

    this.resetResourceForm();
    this.showToast(`منبع «${title}» با موفقیت ذخیره شد.`, 'success');
    this.renderResourcesView();
  }

  editResource(id) {
    const r = this.state.resources.find(item => item.id === id);
    if (!r) return;
    document.getElementById('res-id').value = r.id;
    document.getElementById('res-course').value = r.courseId;
    document.getElementById('res-title').value = r.title;
    document.getElementById('res-author').value = r.author || '';
    document.getElementById('res-type').value = r.type || 'book';
    document.getElementById('res-required').value = r.isRequired || 'required';
    document.getElementById('res-total-pages').value = r.totalPages || '';
    document.getElementById('res-ranges').value = (r.assignedRanges && r.assignedRanges !== 'نامشخص') ? r.assignedRanges : (r.assignedRanges === 'نامشخص' ? 'نامشخص' : '');
    document.getElementById('res-speed').value = r.readingSpeedPagesPerHour || 15;
    document.getElementById('res-completed-pages').value = r.completedPages || 0;
    document.getElementById('res-position').value = r.currentPosition || '';
    document.getElementById('res-importance').value = r.importance || 'high';
    document.getElementById('res-difficulty').value = r.difficulty || 'normal';
    document.getElementById('res-notes').value = r.notes || '';
    document.getElementById('res-pending-notes').value = r.pendingNotes || '';
    document.getElementById('resource-form-title').textContent = `ویرایش منبع: ${r.title}`;
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }

  async deleteResource(id) {
    if (confirm('آیا از حذف این منبع اطمینان دارید؟')) {
      await this.db.delete('resources', id);
      this.state.resources = this.state.resources.filter(r => r.id !== id);
      this.renderResourcesView();
      this.showToast('منبع حذف شد.', 'info');
    }
  }

  resetResourceForm() {
    document.getElementById('res-id').value = '';
    document.getElementById('res-title').value = '';
    document.getElementById('res-author').value = '';
    document.getElementById('res-total-pages').value = '';
    document.getElementById('res-ranges').value = '';
    document.getElementById('res-completed-pages').value = '0';
    document.getElementById('res-position').value = '';
    document.getElementById('res-notes').value = '';
    document.getElementById('res-pending-notes').value = '';
    document.getElementById('resource-form-title').textContent = 'افزودن منبع مطالعاتی (کتاب، مقاله، متن کهن، جزوه)';
  }

  handleResourceFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const notesEl = document.getElementById('res-notes');
      if (notesEl) {
        notesEl.value = (notesEl.value ? notesEl.value + '\n\n' : '') + text.substring(0, 5000);
      }
      this.showToast(`فایل «${file.name}» بارگذاری شد.`, 'success');
    };
    reader.readAsText(file);
  }

  /***********************************************************************
   * ۵. تقویم جلالی و برنامه‌ریزی جلسات
   ***********************************************************************/
  setCalendarMode(mode) {
    this.calendarMode = mode;
    ['daily', 'weekly', 'monthly'].forEach(m => {
      const btn = document.getElementById(`cal-mode-${m}`);
      if (btn) {
        if (m === mode) {
          btn.className = 'px-3 py-1.5 bg-brand-600 text-white font-medium';
        } else {
          btn.className = 'px-3 py-1.5 bg-white hover:bg-slate-50 font-medium';
        }
      }
    });
    this.renderCalendarView();
  }

  shiftCalendar(delta) {
    if (this.calendarMode === 'daily') {
      this.calendarCursorJalali = JalaliDateEngine.addDaysJalali(this.calendarCursorJalali, delta);
    } else if (this.calendarMode === 'weekly') {
      this.calendarCursorJalali = JalaliDateEngine.addDaysJalali(this.calendarCursorJalali, delta * 7);
    } else if (this.calendarMode === 'monthly') {
      const [jy, jm, jd] = this.calendarCursorJalali.split('/').map(Number);
      let newJm = jm + delta;
      let newJy = jy;
      if (newJm > 12) { newJm = 1; newJy++; }
      if (newJm < 1) { newJm = 12; newJy--; }
      this.calendarCursorJalali = JalaliDateEngine.formatJalali(newJy, newJm, Math.min(jd, JalaliDateEngine.getMonthDaysCount(newJy, newJm)));
    }
    this.renderCalendarView();
  }

  resetCalendarToToday() {
    this.calendarCursorJalali = JalaliDateEngine.todayJalali();
    this.renderCalendarView();
  }

  renderCalendarView() {
    const rangeLabel = document.getElementById('calendar-range-label');
    const container = document.getElementById('calendar-grid-container');
    if (!container) return;

    if (this.calendarMode === 'daily') {
      rangeLabel.textContent = JalaliDateEngine.toReadablePersianDate(this.calendarCursorJalali);
      this.renderDailyCalendar(container, this.calendarCursorJalali);
    } else if (this.calendarMode === 'weekly') {
      // پیدا کردن شنبه هفته جاری
      const pIndex = JalaliDateEngine.getWeekdayIndexPersian(this.calendarCursorJalali);
      const weekStart = JalaliDateEngine.addDaysJalali(this.calendarCursorJalali, -pIndex);
      const weekEnd = JalaliDateEngine.addDaysJalali(weekStart, 6);
      rangeLabel.textContent = `هفته: ${JalaliDateEngine.toReadablePersianDate(weekStart)} تا ${JalaliDateEngine.toReadablePersianDate(weekEnd)}`;
      this.renderWeeklyCalendar(container, weekStart);
    } else if (this.calendarMode === 'monthly') {
      const [jy, jm] = this.calendarCursorJalali.split('/').map(Number);
      rangeLabel.textContent = `ماه ${JalaliDateEngine.PERSIAN_MONTHS[jm - 1]} سال ${JalaliDateEngine.toPersianDigits(jy)}`;
      this.renderMonthlyCalendar(container, jy, jm);
    }
  }

  renderDailyCalendar(container, dateJalali) {
    const dayTasks = this.state.tasks.filter(t => t.date === dateJalali);
    const weekday = JalaliDateEngine.getWeekdayName(dateJalali);
    const dayClasses = this.state.courses.filter(c => c.classDay === weekday);

    container.innerHTML = `
      <div class="space-y-4">
        ${dayClasses.length > 0 ? `
          <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
            <h4 class="font-bold text-indigo-900 text-xs">کلاس‌های دانشگاه در این روز:</h4>
            ${dayClasses.map(c => `
              <div class="text-xs text-indigo-800 flex justify-between">
                <span>• ${this.escapeHTML(c.name)} (${this.escapeHTML(c.instructor || 'استاد')})</span>
                <span>ساعت ${JalaliDateEngine.toPersianDigits(c.classStartTime)} تا ${JalaliDateEngine.toPersianDigits(c.classEndTime)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="space-y-2">
          ${dayTasks.length === 0 ? `
            <div class="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
              جلسه مطالعه‌ای برای این روز ثبت نشده است.
            </div>
          ` : dayTasks.map(t => this.renderTaskCard(t)).join('')}
        </div>
      </div>
    `;
  }

  renderWeeklyCalendar(container, weekStartJalali) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(JalaliDateEngine.addDaysJalali(weekStartJalali, i));
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-7 gap-2">
        ${days.map(d => {
          const weekday = JalaliDateEngine.getWeekdayName(d);
          const isToday = d === JalaliDateEngine.todayJalali();
          const dayTasks = this.state.tasks.filter(t => t.date === d);
          const dayClasses = this.state.courses.filter(c => c.classDay === weekday);
          const dayExams = this.state.courses.filter(c => c.examDate === d);

          return `
            <div class="rounded-xl border ${isToday ? 'border-brand-500 bg-brand-50/20 shadow-sm' : 'border-slate-200 bg-white'} p-2.5 flex flex-col min-h-[320px]">
              <div class="text-center pb-2 border-b border-slate-100 mb-2">
                <div class="font-bold text-xs ${isToday ? 'text-brand-700' : 'text-slate-800'}">${weekday}</div>
                <div class="text-[11px] text-slate-500 font-mono">${JalaliDateEngine.toPersianDigits(d.split('/')[2])} ${JalaliDateEngine.PERSIAN_MONTHS[Number(d.split('/')[1]) - 1]}</div>
              </div>

              <div class="space-y-1.5 flex-1 overflow-y-auto">
                ${dayClasses.map(c => `
                  <div class="p-1.5 rounded bg-indigo-50 border border-indigo-200 text-[10px] text-indigo-900 font-semibold" title="کلاس دانشگاه">
                    کلاس: ${this.escapeHTML(c.name)}
                    <div class="text-[9px] text-indigo-700 font-normal">${JalaliDateEngine.toPersianDigits(c.classStartTime)}-${JalaliDateEngine.toPersianDigits(c.classEndTime)}</div>
                  </div>
                `).join('')}

                ${dayExams.map(c => `
                  <div class="p-1.5 rounded bg-rose-100 border border-rose-300 text-[10px] text-rose-900 font-bold" title="امتحان پایانی">
                    امتحان: ${this.escapeHTML(c.name)}
                  </div>
                `).join('')}

                ${dayTasks.map(t => {
                  const actColors = {
                    initial_reading: 'bg-sky-50 border-sky-200 text-sky-900',
                    analytical_notes: 'bg-teal-50 border-teal-200 text-teal-900',
                    chronology: 'bg-amber-50 border-amber-200 text-amber-900',
                    source_criticism: 'bg-purple-50 border-purple-200 text-purple-900',
                    historiography: 'bg-indigo-50 border-indigo-200 text-indigo-900',
                    research_paper: 'bg-purple-100 border-purple-300 text-purple-900',
                    spaced_review: 'bg-orange-50 border-orange-200 text-orange-900',
                    essay_practice: 'bg-indigo-50 border-indigo-200 text-indigo-900',
                    final_revision: 'bg-rose-50 border-rose-200 text-rose-900'
                  };
                  return `
                    <div onclick="app.openEditTaskModal('${t.id}')" class="p-1.5 rounded border text-[10px] cursor-pointer hover:shadow-sm transition ${actColors[t.activityType] || 'bg-slate-50 border-slate-200 text-slate-800'}">
                      <div class="font-bold truncate">${this.escapeHTML(t.title)}</div>
                      <div class="flex justify-between text-[9px] opacity-80 mt-0.5">
                        <span>${JalaliDateEngine.toPersianDigits(t.startTime)}</span>
                        <span>${t.status === 'completed' ? 'تکمیل' : `${JalaliDateEngine.toPersianDigits(t.durationMinutes)} د`}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderMonthlyCalendar(container, jy, jm) {
    const daysInMonth = JalaliDateEngine.getMonthDaysCount(jy, jm);
    const firstDayStr = JalaliDateEngine.formatJalali(jy, jm, 1);
    const startOffset = JalaliDateEngine.getWeekdayIndexPersian(firstDayStr);

    let cellsHTML = '';
    // سلول‌های خالی قبل از شروع ماه
    for (let i = 0; i < startOffset; i++) {
      cellsHTML += `<div class="min-h-[85px] bg-slate-50/50 border border-slate-100 rounded-lg"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const curJ = JalaliDateEngine.formatJalali(jy, jm, day);
      const isToday = curJ === JalaliDateEngine.todayJalali();
      const dayTasks = this.state.tasks.filter(t => t.date === curJ);
      const dayExams = this.state.courses.filter(c => c.examDate === curJ);

      cellsHTML += `
        <div onclick="app.calendarCursorJalali='${curJ}'; app.setCalendarMode('daily');" class="min-h-[85px] border ${isToday ? 'border-brand-500 bg-brand-50/30' : 'border-slate-200 bg-white'} rounded-lg p-1.5 flex flex-col justify-between hover:border-brand-400 cursor-pointer transition">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold ${isToday ? 'text-brand-700' : 'text-slate-800'}">${JalaliDateEngine.toPersianDigits(day)}</span>
            ${dayExams.length > 0 ? `<span class="w-2 h-2 rounded-full bg-rose-600" title="امتحان"></span>` : ''}
          </div>
          <div class="space-y-0.5 overflow-hidden">
            ${dayTasks.slice(0, 2).map(t => `
              <div class="text-[9px] truncate px-1 rounded bg-slate-100 text-slate-700">${this.escapeHTML(t.title)}</div>
            `).join('')}
            ${dayTasks.length > 2 ? `<div class="text-[9px] text-brand-700 text-center font-bold">+${JalaliDateEngine.toPersianDigits(dayTasks.length - 2)} مورد</div>` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="space-y-2">
        <div class="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-600 pb-1">
          ${JalaliDateEngine.WEEKDAYS_ORDERED.map(w => `<div>${w}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-2">
          ${cellsHTML}
        </div>
      </div>
    `;
  }

  /***********************************************************************
   * ۶. مدیریت وظایف و ثبت پیشرفت واقعی
   ***********************************************************************/
  renderTasksView() {
    const container = document.getElementById('tasks-list-container');
    if (!container) return;

    const courseFilter = document.getElementById('filter-task-course')?.value || 'all';
    const statusFilter = document.getElementById('filter-task-status')?.value || 'all';
    const activityFilter = document.getElementById('filter-task-activity')?.value || 'all';
    const dateFilter = JalaliDateEngine.toEnglishDigits(document.getElementById('filter-task-date')?.value || '').trim();

    let filtered = [...this.state.tasks];
    if (courseFilter !== 'all') filtered = filtered.filter(t => t.courseId === courseFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
    if (activityFilter !== 'all') filtered = filtered.filter(t => t.activityType === activityFilter);
    if (dateFilter) filtered = filtered.filter(t => t.date && t.date.includes(dateFilter));

    filtered.sort((a, b) => JalaliDateEngine.diffDaysJalali(b.date, a.date));

    if (filtered.length === 0) {
      container.innerHTML = `<p class="text-slate-400 text-center py-8 text-xs">جلسه یا تکلیفی با این مشخصات یافت نشد.</p>`;
      return;
    }

    container.innerHTML = filtered.map(t => this.renderTaskCard(t)).join('');
  }

  renderTaskCard(t) {
    const crs = this.state.courses.find(c => c.id === t.courseId);
    const actLabels = {
      initial_reading: 'مطالعه اولیه متن',
      analytical_notes: 'فیش‌برداری تحلیلی',
      chronology: 'گاهشمار و توالی وقایع',
      source_criticism: 'نقد منبع و مقایسه روایت‌ها',
      historiography: 'تحلیل تاریخ‌نگارانه',
      research_paper: 'پژوهش و نگارش مقاله',
      spaced_review: 'مرور با فاصله و بازیابی',
      essay_practice: 'نگارش پاسخ تشریحی استدلالی',
      timed_exam: 'آزمون شبیه‌سازی زمان‌دار',
      final_revision: 'جمع‌بندی نهایی پیش از امتحان'
    };

    const statusClasses = {
      pending: 'border-slate-300 bg-white',
      completed: 'border-emerald-300 bg-emerald-50/30',
      partial: 'border-amber-300 bg-amber-50/30',
      missed: 'border-rose-300 bg-rose-50/30',
      cancelled: 'border-slate-300 bg-slate-100/70 opacity-70'
    };

    return `
      <div class="p-4 rounded-xl border ${statusClasses[t.status] || 'border-slate-200 bg-white'} shadow-sm space-y-2 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900 text-sm">${this.escapeHTML(t.title)}</span>
            <span class="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-[11px] font-medium">${crs ? this.escapeHTML(crs.name) : 'درس عمومی'}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">${actLabels[t.activityType] || t.activityType}</span>
            <select onchange="app.quickToggleTaskStatus('${t.id}', this.value)" class="border rounded px-2 py-1 text-xs bg-white font-semibold">
              <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>در انتظار</option>
              <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>تکمیل کامل</option>
              <option value="partial" ${t.status === 'partial' ? 'selected' : ''}>تکمیل جزئی</option>
              <option value="missed" ${t.status === 'missed' ? 'selected' : ''}>انجام‌نشده (عقب‌افتاده)</option>
              <option value="cancelled" ${t.status === 'cancelled' ? 'selected' : ''}>لغو / تعلیق‌شده</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
          <div>تاریخ: <strong class="text-slate-900">${JalaliDateEngine.toReadablePersianDate(t.date)}</strong></div>
          <div>زمان: <strong class="text-slate-900">${JalaliDateEngine.toPersianDigits(t.startTime)} تا ${JalaliDateEngine.toPersianDigits(t.endTime)} (${JalaliDateEngine.toPersianDigits(t.durationMinutes)} د)</strong></div>
          <div>زمان واقعی: <strong class="text-emerald-700">${JalaliDateEngine.toPersianDigits(t.actualDurationMinutes || 0)} دقیقه</strong></div>
          <div>صفحات خوانده‌شده: <strong class="text-slate-900">${JalaliDateEngine.toPersianDigits(t.completedPagesCount || 0)} صفحه</strong></div>
        </div>

        ${t.objective ? `<div class="text-slate-600 text-[11px]"><span class="font-semibold text-slate-800">هدف جلسه:</span> ${this.escapeHTML(t.objective)}</div>` : ''}
        ${t.notes ? `<div class="p-2 rounded bg-amber-50 text-amber-900 text-[11px] border border-amber-200">${this.escapeHTML(t.notes)}</div>` : ''}

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <button onclick="app.openPomodoroModal('${t.id}')" title="شروع نشست با تایمر پومودورو" class="text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 font-semibold px-2.5 py-1 rounded transition text-xs flex items-center gap-1 shadow-sm">
            <span>⏱️</span>
            <span>اجرا با پومودورو</span>
          </button>
          <div class="flex items-center gap-2">
            <button onclick="app.openEditTaskModal('${t.id}')" class="text-brand-600 hover:underline font-semibold text-xs">ثبت دقیق گزارش عملکرد</button>
            <button onclick="app.deleteTask('${t.id}')" class="text-rose-600 hover:underline text-xs">حذف</button>
          </div>
        </div>
      </div>
    `;
  }

  openManualTaskModal() {
    document.getElementById('task-modal-title').textContent = 'افزودن دستی جلسه مطالعه';
    document.getElementById('tm-id').value = '';
    document.getElementById('tm-title').value = '';
    document.getElementById('tm-date').value = JalaliDateEngine.todayJalali();
    document.getElementById('tm-start').value = '14:00';
    document.getElementById('tm-duration').value = '75';
    document.getElementById('tm-status').value = 'pending';
    document.getElementById('tm-actual-duration').value = '0';
    document.getElementById('tm-pages-done').value = '0';
    document.getElementById('tm-notes').value = '';
    document.getElementById('task-action-modal').classList.remove('hidden');
    document.getElementById('task-action-modal').classList.add('flex');
  }

  openEditTaskModal(id) {
    const t = this.state.tasks.find(item => item.id === id);
    if (!t) return;
    document.getElementById('task-modal-title').textContent = 'ثبت گزارش و وضعیت جلسه مطالعه';
    document.getElementById('tm-id').value = t.id;
    document.getElementById('tm-course').value = t.courseId;
    document.getElementById('tm-title').value = t.title;
    document.getElementById('tm-date').value = t.date;
    document.getElementById('tm-activity').value = t.activityType || 'initial_reading';
    document.getElementById('tm-start').value = t.startTime || '14:00';
    document.getElementById('tm-duration').value = t.durationMinutes || 75;
    document.getElementById('tm-status').value = t.status || 'pending';
    document.getElementById('tm-actual-duration').value = t.actualDurationMinutes || t.durationMinutes;
    document.getElementById('tm-pages-done').value = t.completedPagesCount || t.pagesTargetCount || 0;
    document.getElementById('tm-notes').value = t.notes || '';
    document.getElementById('task-action-modal').classList.remove('hidden');
    document.getElementById('task-action-modal').classList.add('flex');
  }

  closeTaskModal() {
    document.getElementById('task-action-modal').classList.add('hidden');
    document.getElementById('task-action-modal').classList.remove('flex');
  }

  async submitTaskModal(event) {
    event.preventDefault();
    const id = document.getElementById('tm-id').value || `task_${Date.now()}`;
    const courseId = document.getElementById('tm-course').value;
    const title = document.getElementById('tm-title').value.trim();
    const date = JalaliDateEngine.normalizeJalali(document.getElementById('tm-date').value.trim());
    const activityType = document.getElementById('tm-activity').value;
    const startTime = document.getElementById('tm-start').value;
    const durationMinutes = Number(document.getElementById('tm-duration').value) || 75;
    const status = document.getElementById('tm-status').value;
    const actualDurationMinutes = Number(document.getElementById('tm-actual-duration').value) || 0;
    const completedPagesCount = Number(document.getElementById('tm-pages-done').value) || 0;
    const notes = document.getElementById('tm-notes').value.trim();

    if (!JalaliDateEngine.isValidJalaliString(date)) {
      this.showToast('فرمت تاریخ نامعتبر است (مثال: 1405/08/12)', 'error');
      return;
    }

    // ۱. خواندن رکورد قبلی و حفظ تمام فیلدهای قبلی (resourceId, objective, rangeOrTopic, pagesTargetCount, priority)
    const existingTask = this.state.tasks.find(t => t.id === id);
    const prevPagesDone = existingTask ? (Number(existingTask.completedPagesCount) || 0) : 0;

    // محاسبه مجدد endTime بر اساس startTime و durationMinutes جدید
    let endTime = existingTask?.endTime || '';
    if (startTime && durationMinutes) {
      const [sh, sm] = startTime.split(':').map(Number);
      const totalM = sh * 60 + sm + durationMinutes;
      const endH = Math.floor(totalM / 60) % 24;
      const endM = totalM % 60;
      endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }

    const taskObj = {
      ...(existingTask || {}),
      id,
      courseId,
      title,
      date,
      activityType,
      startTime,
      endTime,
      durationMinutes,
      status,
      actualDurationMinutes,
      completedPagesCount,
      notes,
      updatedAt: new Date().toISOString()
    };
    if (!existingTask) {
      taskObj.createdAt = new Date().toISOString();
      taskObj.isManual = true;
    }

    await this.db.put('tasks', taskObj);
    const existIdx = this.state.tasks.findIndex(t => t.id === id);
    if (existIdx >= 0) this.state.tasks[existIdx] = taskObj;
    else this.state.tasks.push(taskObj);

    // ۲. بروزرسانی صفحات منبع بر اساس مابه‌التفاوت (Delta) با اولویت جستجوی resourceId
    const deltaPages = completedPagesCount - prevPagesDone;
    if (deltaPages !== 0) {
      const targetResId = taskObj.resourceId;
      const relRes = (targetResId && this.state.resources.find(r => r.id === targetResId)) ||
                     this.state.resources.find(r => r.courseId === courseId);
      if (relRes) {
        relRes.completedPages = Math.max(0, (Number(relRes.completedPages) || 0) + deltaPages);
        if (relRes.totalPages && relRes.completedPages > relRes.totalPages) {
          relRes.completedPages = relRes.totalPages;
        }
        await this.db.put('resources', relRes);
      }
    }

    this.closeTaskModal();
    this.showToast('وضعیت جلسه با موفقیت ذخیره شد.', 'success');
    this.renderCurrentView();
  }

  async quickToggleTaskStatus(id, newStatus) {
    const t = this.state.tasks.find(item => item.id === id);
    if (!t) return;
    const oldStatus = t.status;
    t.status = newStatus;
    if (newStatus === 'completed') {
      if (!t.actualDurationMinutes) {
        t.actualDurationMinutes = t.durationMinutes;
      }
      // در صورت تکمیل، اگر تسک دارای هدف صفحات است و قبلاً صفحات ثبت نشده، صفحات منبع را جلو ببر
      if (t.pagesTargetCount && (!t.completedPagesCount || t.completedPagesCount === 0)) {
        const pagesToAdd = Number(t.pagesTargetCount) || 0;
        t.completedPagesCount = pagesToAdd;
        const targetResId = t.resourceId;
        const relRes = (targetResId && this.state.resources.find(r => r.id === targetResId)) ||
                       this.state.resources.find(r => r.courseId === t.courseId);
        if (relRes && pagesToAdd > 0) {
          relRes.completedPages = Math.max(0, (Number(relRes.completedPages) || 0) + pagesToAdd);
          if (relRes.totalPages && relRes.completedPages > relRes.totalPages) {
            relRes.completedPages = relRes.totalPages;
          }
          await this.db.put('resources', relRes);
        }
      }
    }
    await this.db.put('tasks', t);
    this.showToast(`وضعیت به «${newStatus}» تغییر یافت.`, 'success');
    this.renderCurrentView();
  }

  async deleteTask(id) {
    if (confirm('آیا از حذف این جلسه مطالعه اطمینان دارید؟')) {
      await this.db.delete('tasks', id);
      this.state.tasks = this.state.tasks.filter(t => t.id !== id);
      this.renderCurrentView();
      this.showToast('جلسه حذف شد.', 'info');
    }
  }

  quickAddSpacedReviewTask(courseId, topic) {
    const todayJ = JalaliDateEngine.todayJalali();
    const reviewDate = JalaliDateEngine.addDaysJalali(todayJ, 1);
    const crs = this.state.courses.find(c => c.id === courseId);

    const newTask = {
      id: `task_${Date.now()}_rev`,
      courseId,
      title: `مرور فوری و بازیابی فعال: ${topic} (${crs ? crs.name : ''})`,
      rangeOrTopic: topic,
      date: reviewDate,
      startTime: '16:00',
      endTime: '17:00',
      durationMinutes: 60,
      objective: `رفع ضعف در مبحث «${topic}» و آزمون بازیابی فعال مفاهیم`,
      activityType: 'spaced_review',
      priority: 95,
      status: 'pending',
      actualDurationMinutes: 0,
      completedPagesCount: 0,
      pagesTargetCount: 0,
      notes: '',
      createdAt: new Date().toISOString()
    };

    this.db.put('tasks', newTask).then(() => {
      this.state.tasks.push(newTask);
      this.showToast(`جلسه مرور برای فردا (${JalaliDateEngine.toReadablePersianDate(reviewDate)}) برنامه‌ریزی شد.`, 'success');
      this.renderCurrentView();
    });
  }

  /***********************************************************************
   * ۷. سنجش تسلط و آزمون‌های آزمایشی
   ***********************************************************************/
  toggleAssessScoreUnknown(checked) {
    const scoreInput = document.getElementById('assess-score');
    if (scoreInput) {
      scoreInput.disabled = checked;
      if (checked) {
        scoreInput.classList.add('bg-slate-100', 'text-slate-400');
        scoreInput.value = '';
      } else {
        scoreInput.classList.remove('bg-slate-100', 'text-slate-400');
        scoreInput.value = '17.5';
      }
    }
  }

  renderAssessmentsView() {
    const masteryContainer = document.getElementById('mastery-topics-container');
    const logContainer = document.getElementById('assessments-log-container');

    if (masteryContainer) {
      if (this.state.mastery.length === 0) {
        masteryContainer.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">هنوز هیچ مبحثی ارزیابی نشده است.</p>`;
      } else {
        masteryContainer.innerHTML = `
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-bold border-b">
              <tr>
                <th class="p-2.5">درس</th>
                <th class="p-2.5">مبحث / بازه تاریخی</th>
                <th class="p-2.5">آخرین نمره</th>
                <th class="p-2.5">درصد تسلط</th>
                <th class="p-2.5">موعد مرور بعدی</th>
                <th class="p-2.5">وضعیت</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${this.state.mastery.map(m => {
                const crs = this.state.courses.find(c => c.id === m.courseId);
                const isWeak = m.masteryLevel < 75 || (m.lastScore !== null && m.lastScore < 17);
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="p-2.5 font-bold text-slate-800">${crs ? this.escapeHTML(crs.name) : ''}</td>
                    <td class="p-2.5 font-medium">${this.escapeHTML(m.topic)}</td>
                    <td class="p-2.5 font-bold text-brand-700">${m.lastScore !== null ? `${JalaliDateEngine.toPersianDigits(m.lastScore)} از ۲۰` : '<span class="text-amber-800 font-normal">کیفی</span>'}</td>
                    <td class="p-2.5">${JalaliDateEngine.toPersianDigits(m.masteryLevel)}٪</td>
                    <td class="p-2.5 font-mono">${JalaliDateEngine.toReadablePersianDate(m.nextReviewDate)}</td>
                    <td class="p-2.5">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isWeak ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                        ${isWeak ? 'نیازمند مرور و تقویت' : 'تسلط مطلوب'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }
    }

    if (logContainer) {
      if (this.state.assessments.length === 0) {
        logContainer.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">سابقه‌ای ثبت نشده است.</p>`;
      } else {
        logContainer.innerHTML = this.state.assessments.slice(-10).reverse().map(a => {
          const crs = this.state.courses.find(c => c.id === a.courseId);
          return `
            <div class="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
              <div class="flex items-center justify-between border-b pb-1.5">
                <div>
                  <span class="font-bold text-slate-800">${this.escapeHTML(a.topic)}</span>
                  <span class="text-slate-500 mr-2">(${crs ? this.escapeHTML(crs.name) : ''})</span>
                </div>
                <span class="font-extrabold text-sm text-brand-700">${a.score !== null ? `${JalaliDateEngine.toPersianDigits(a.score)} از ۲۰` : '<span class="bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-200">سنجش کیفی و استدلالی</span>'}</span>
              </div>
              ${a.errors ? `<div class="p-2 rounded bg-slate-50 text-slate-600 text-[11px] leading-relaxed"><strong class="text-slate-800">تحلیل خطاها:</strong> ${this.escapeHTML(a.errors)}</div>` : ''}
              <div class="flex justify-between items-center text-[10px] text-slate-400">
                <span>ثبت در تاریخ: ${JalaliDateEngine.toReadablePersianDate(a.date)}</span>
                <button onclick="app.deleteAssessmentLog('${a.id}')" class="text-rose-600 hover:underline">حذف رکورد</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  async saveAssessmentLog(event) {
    event.preventDefault();
    const courseId = document.getElementById('assess-course').value;
    const topic = document.getElementById('assess-topic').value.trim();
    const assessType = document.getElementById('assess-type').value;
    const category = document.getElementById('assess-category').value;
    const isQualitative = document.getElementById('assess-score-unknown')?.checked || false;
    const score = isQualitative ? null : (Number(document.getElementById('assess-score').value) || 0);
    const mastery = Number(document.getElementById('assess-mastery').value) || 0;
    const errors = document.getElementById('assess-errors').value.trim();
    const todayJ = JalaliDateEngine.todayJalali();

    if (!courseId || !topic) {
      this.showToast('درس و مبحث الزامی هستند.', 'error');
      return;
    }

    const assessId = `assess_${Date.now()}`;
    const logItem = {
      id: assessId, courseId, topic, assessType, category, score, mastery, errors,
      date: todayJ,
      createdAt: new Date().toISOString()
    };
    await this.db.put('assessments', logItem);
    this.state.assessments.push(logItem);

    // بروزرسانی جدول تسلط و محاسبه فاصله مرور بعدی
    let daysToAdd = 14;
    if (isQualitative) {
      daysToAdd = mastery < 60 ? 3 : (mastery < 80 ? 7 : 14);
    } else {
      if (score < 14 || mastery < 60) daysToAdd = 2;
      else if (score < 17 || mastery < 75) daysToAdd = 5;
      else if (score < 18.5) daysToAdd = 9;
    }

    const nextReviewDate = JalaliDateEngine.addDaysJalali(todayJ, daysToAdd);

    const masteryId = `mast_${courseId}_${encodeURIComponent(topic)}`;
    const masteryItem = {
      id: masteryId,
      courseId,
      topic,
      category,
      lastScore: score,
      masteryLevel: mastery,
      lastAssessedDate: todayJ,
      nextReviewDate,
      reviewCount: 1
    };

    await this.db.put('mastery', masteryItem);
    const mIdx = this.state.mastery.findIndex(m => m.id === masteryId);
    if (mIdx >= 0) this.state.mastery[mIdx] = masteryItem;
    else this.state.mastery.push(masteryItem);

    this.showToast(`نتیجه آزمون ثبت شد. موعد مرور بعدی: ${JalaliDateEngine.toReadablePersianDate(nextReviewDate)}`, 'success');
    this.renderAssessmentsView();
  }

  async deleteAssessmentLog(id) {
    if (confirm('آیا از حذف این رکورد ارزیابی اطمینان دارید؟')) {
      await this.db.delete('assessments', id);
      this.state.assessments = this.state.assessments.filter(a => a.id !== id);
      this.renderAssessmentsView();
      this.showToast('رکورد حذف شد.', 'info');
    }
  }

  generateHistoryPracticePrompt() {
    const courseId = document.getElementById('assess-course').value;
    const topic = document.getElementById('assess-topic').value.trim();
    const crs = this.state.courses.find(c => c.id === courseId);
    const courseName = crs ? crs.name : 'تاریخ ایران عصر صفوی';

    const promptText = `لطفاً بر مبنای مباحث تخصصی درس «${courseName}» و سرفصل «${topic || 'ساختار قدرت، مشروعیت مذهبی و تحولات دیوان‌سالاری'}»، یک سوال تشریحی-تحلیلی سطح کارشناسی ارشد (جهت تمرین کسب نمره ۱۹ تا ۲۰) طراحی کنید. همراه با معیارهای ارزیابی استدلال، شواهد تاریخی و نقد منابع معاصر آن دوره.`;

    this.navigate('advisor');
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = promptText;
      input.focus();
    }
  }

  /***********************************************************************
   * ۸. خروجی PDF / Markdown / iCalendar و مدیریت پشتیبان JSON
   ***********************************************************************/
  toggleExportScopeFilters() {
    const scope = document.getElementById('export-scope')?.value;
    const courseFilter = document.getElementById('export-course-filter');
    const dateFilter = document.getElementById('export-date-filter');

    if (courseFilter) {
      if (scope === 'single_course') courseFilter.classList.remove('hidden');
      else courseFilter.classList.add('hidden');
    }
    if (dateFilter) {
      if (scope === 'date_range') dateFilter.classList.remove('hidden');
      else dateFilter.classList.add('hidden');
    }
    this.refreshExportPreview();
  }

  buildExportDocumentData() {
    const scope = document.getElementById('export-scope')?.value || 'full_semester';
    let targetCourses = [...this.state.courses];
    let targetTasks = [...this.state.tasks];
    let title = 'گزارش و برنامه تحصیلی تحصیلات تکمیلی تاریخ ایران';
    let subtitle = 'گرایش تاریخ ایران دوره اسلامی';

    if (scope === 'single_course') {
      const cId = document.getElementById('export-course-id')?.value;
      targetCourses = targetCourses.filter(c => c.id === cId);
      targetTasks = targetTasks.filter(t => t.courseId === cId);
      if (targetCourses[0]) title = `برنامه اختصاصی و کارنامه درس: ${targetCourses[0].name}`;
    } else if (scope === 'weekly') {
      const todayJ = JalaliDateEngine.todayJalali();
      const endJ = JalaliDateEngine.addDaysJalali(todayJ, 7);
      targetTasks = targetTasks.filter(t =>
        JalaliDateEngine.diffDaysJalali(todayJ, t.date) >= 0 &&
        JalaliDateEngine.diffDaysJalali(t.date, endJ) >= 0
      );
      title = `برنامه مطالعاتی هفتگی (${JalaliDateEngine.toReadablePersianDate(todayJ)} تا ${JalaliDateEngine.toReadablePersianDate(endJ)})`;
    } else if (scope === 'date_range') {
      const rawStart = document.getElementById('export-start-date')?.value.trim();
      const rawEnd = document.getElementById('export-end-date')?.value.trim();
      const startJ = JalaliDateEngine.isValidJalaliString(rawStart) ? JalaliDateEngine.normalizeJalali(rawStart) : JalaliDateEngine.todayJalali();
      const endJ = JalaliDateEngine.isValidJalaliString(rawEnd) ? JalaliDateEngine.normalizeJalali(rawEnd) : JalaliDateEngine.addDaysJalali(startJ, 30);
      targetTasks = targetTasks.filter(t =>
        JalaliDateEngine.diffDaysJalali(startJ, t.date) >= 0 &&
        JalaliDateEngine.diffDaysJalali(t.date, endJ) >= 0
      );
      title = `برنامه بازه زمانی انتخابی (${JalaliDateEngine.toReadablePersianDate(startJ)} تا ${JalaliDateEngine.toReadablePersianDate(endJ)})`;
    }

    const incCourses = document.getElementById('exp-inc-courses')?.checked ?? true;
    const incResources = document.getElementById('exp-inc-resources')?.checked ?? true;
    const incSchedule = document.getElementById('exp-inc-schedule')?.checked ?? true;
    const incMastery = document.getElementById('exp-inc-mastery')?.checked ?? true;

    // محاسبه وضعیت آمادگی و تسلط برای دروس انتخاب‌شده
    const masteryData = targetCourses.map(c => {
      const cResources = this.state.resources.filter(r => r.courseId === c.id);
      const totalPages = cResources.reduce((s, r) => s + (DeterministicScheduler.calculateAssignedPages(r.assignedRanges, r.totalPages) || 0), 0);
      const completedPages = cResources.reduce((s, r) => s + (Number(r.completedPages) || 0), 0);
      const pagePct = totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 100)) : 0;

      const cAssess = this.state.assessments.filter(a => a.courseId === c.id);
      const avgScore = cAssess.length > 0 ? (cAssess.reduce((s, a) => s + (Number(a.score) || 0), 0) / cAssess.length) : 0;
      const assessPct = (avgScore / 20) * 100;

      let readiness = 0;
      if (totalPages > 0 && cAssess.length > 0) readiness = Math.round(pagePct * 0.5 + assessPct * 0.5);
      else if (totalPages > 0) readiness = Math.round(pagePct * 0.7);
      else if (cAssess.length > 0) readiness = Math.round(assessPct * 0.7);
      else readiness = Number(c.initialMastery) || 20;

      return {
        course: c,
        totalPages,
        completedPages,
        pagePct,
        assessCount: cAssess.length,
        avgScore: avgScore.toFixed(1),
        readiness
      };
    });

    return {
      title,
      subtitle,
      scope,
      incCourses,
      incResources,
      incSchedule,
      incMastery,
      courses: targetCourses,
      resources: this.state.resources.filter(r => targetCourses.some(c => c.id === r.courseId)),
      tasks: targetTasks,
      masteryData
    };
  }

  refreshExportPreview() {
    const previewEl = document.getElementById('export-live-preview');
    if (!previewEl) return;
    const docData = this.buildExportDocumentData();

    let html = `
      <div class="space-y-4">
        <div class="border-b pb-2">
          <h3 class="font-bold text-base text-slate-900">${this.escapeHTML(docData.title)}</h3>
          <p class="text-xs text-slate-500">${this.escapeHTML(docData.subtitle)} | تاریخ گزارش: ${JalaliDateEngine.toReadablePersianDate(JalaliDateEngine.todayJalali())}</p>
        </div>
    `;

    if (docData.incCourses) {
      html += `
        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs">۱. خلاصه دروس و امتحانات:</h4>
          <table class="w-full text-right text-xs border">
            <thead class="bg-slate-100">
              <tr>
                <th class="p-1.5 border">درس</th>
                <th class="p-1.5 border">واحد</th>
                <th class="p-1.5 border">روز و ساعت کلاس</th>
                <th class="p-1.5 border">امتحان</th>
                <th class="p-1.5 border">نمره هدف</th>
              </tr>
            </thead>
            <tbody>
              ${docData.courses.map(c => `
                <tr>
                  <td class="p-1.5 border font-semibold">${this.escapeHTML(c.name)}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(c.units)}</td>
                  <td class="p-1.5 border">${c.classDay ? `${this.escapeHTML(c.classDay)} ${JalaliDateEngine.toPersianDigits(c.classStartTime)}-${JalaliDateEngine.toPersianDigits(c.classEndTime)}` : '-'}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(c.examDate || 'نامشخص')}</td>
                  <td class="p-1.5 border font-bold text-brand-700">${JalaliDateEngine.toPersianDigits(c.targetGrade)} از ۲۰</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (docData.incResources) {
      html += `
        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs">۲. منابع و تکالیف صفحات:</h4>
          <table class="w-full text-right text-xs border">
            <thead class="bg-slate-100">
              <tr>
                <th class="p-1.5 border">عنوان منبع</th>
                <th class="p-1.5 border">نویسنده</th>
                <th class="p-1.5 border">نوع</th>
                <th class="p-1.5 border">بازه صفحات</th>
                <th class="p-1.5 border">پیشرفت</th>
              </tr>
            </thead>
            <tbody>
              ${docData.resources.map(r => `
                <tr>
                  <td class="p-1.5 border font-medium">${this.escapeHTML(r.title)}</td>
                  <td class="p-1.5 border">${this.escapeHTML(r.author || '-')}</td>
                  <td class="p-1.5 border">${this.formatResourceTypeName(r.type)}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(r.assignedRanges || 'نامشخص')}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(r.completedPages || 0)} از ${JalaliDateEngine.toPersianDigits(r.totalPages || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (docData.incSchedule) {
      html += `
        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs">۳. برنامه زمانبندی جلسات مطالعه (${JalaliDateEngine.toPersianDigits(docData.tasks.length)} جلسه):</h4>
          <table class="w-full text-right text-xs border">
            <thead class="bg-slate-100">
              <tr>
                <th class="p-1.5 border">تاریخ</th>
                <th class="p-1.5 border">ساعت</th>
                <th class="p-1.5 border">عنوان جلسه</th>
                <th class="p-1.5 border">روش</th>
                <th class="p-1.5 border">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              ${docData.tasks.slice(0, 15).map(t => `
                <tr>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(t.date)}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(t.startTime)} (${JalaliDateEngine.toPersianDigits(t.durationMinutes)} د)</td>
                  <td class="p-1.5 border font-medium">${this.escapeHTML(t.title)}</td>
                  <td class="p-1.5 border">${this.escapeHTML(t.activityType)}</td>
                  <td class="p-1.5 border">${t.status === 'completed' ? 'تکمیل' : 'در انتظار'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${docData.tasks.length > 15 ? `<p class="text-[11px] text-slate-500">و ${JalaliDateEngine.toPersianDigits(docData.tasks.length - 15)} جلسه دیگر در سند نهایی...</p>` : ''}
        </div>
      `;
    }

    if (docData.incMastery) {
      html += `
        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs">۴. وضعیت تسلط و آمادگی امتحانات (هدف ۱۸ تا ۲۰):</h4>
          <table class="w-full text-right text-xs border">
            <thead class="bg-slate-100">
              <tr>
                <th class="p-1.5 border">درس</th>
                <th class="p-1.5 border">پوشش صفحات</th>
                <th class="p-1.5 border">میانگین آزمون‌ها</th>
                <th class="p-1.5 border">شاخص آمادگی</th>
              </tr>
            </thead>
            <tbody>
              ${docData.masteryData.map(m => `
                <tr>
                  <td class="p-1.5 border font-semibold">${this.escapeHTML(m.course.name)}</td>
                  <td class="p-1.5 border">${JalaliDateEngine.toPersianDigits(m.completedPages)} از ${JalaliDateEngine.toPersianDigits(m.totalPages)} (${JalaliDateEngine.toPersianDigits(m.pagePct)}٪)</td>
                  <td class="p-1.5 border">${m.assessCount > 0 ? `${JalaliDateEngine.toPersianDigits(m.avgScore)} از ۲۰` : 'بدون آزمون'}</td>
                  <td class="p-1.5 border font-bold ${m.readiness >= 75 ? 'text-emerald-700' : 'text-amber-700'}">${JalaliDateEngine.toPersianDigits(m.readiness)}٪</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</div>`;
    previewEl.innerHTML = html;
  }

  exportPDFDocument() {
    const docData = this.buildExportDocumentData();
    const printContainer = document.getElementById('print-container');
    if (!printContainer) return;

    let html = `
      <div style="font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; text-align: right; padding: 20px;">
        <div style="border-bottom: 2px solid #0369a1; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 18pt; margin: 0; color: #0c4a6e;">${this.escapeHTML(docData.title)}</h1>
            <p style="font-size: 10pt; margin: 5px 0 0; color: #475569;">${this.escapeHTML(docData.subtitle)} | هدف نمره ۱۸ تا ۲۰</p>
          </div>
          <div style="font-size: 9pt; color: #64748b; text-align: left;">
            <div>تاریخ چاپ: ${JalaliDateEngine.toReadablePersianDate(JalaliDateEngine.todayJalali())}</div>
            <div>منطقه زمانی: تهران</div>
          </div>
        </div>
    `;

    if (docData.incCourses) {
      html += `
        <h3 style="font-size: 12pt; color: #0f172a; margin-top: 15px;">۱. مشخصات دروس و تقویم امتحانات</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 6px;">نام درس</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">واحد</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">روز و ساعت کلاس</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">تاریخ امتحان</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">فرمت آزمون</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">نمره هدف</th>
            </tr>
          </thead>
          <tbody>
            ${docData.courses.map(c => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${this.escapeHTML(c.name)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${JalaliDateEngine.toPersianDigits(c.units)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${c.classDay ? `${this.escapeHTML(c.classDay)} ${JalaliDateEngine.toPersianDigits(c.classStartTime)}-${JalaliDateEngine.toPersianDigits(c.classEndTime)}` : '-'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${JalaliDateEngine.toPersianDigits(c.examDate || '-')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${this.formatExamTypeName(c.examFormat)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #0284c7; font-weight: bold;">${JalaliDateEngine.toPersianDigits(c.targetGrade)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (docData.incResources) {
      html += `
        <h3 style="font-size: 12pt; color: #0f172a; margin-top: 20px;">۲. منابع و متون تاریخی</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 6px;">عنوان منبع</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">نویسنده</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">نوع</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">بازه صفحات</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">پیشرفت</th>
            </tr>
          </thead>
          <tbody>
            ${docData.resources.map(r => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 500;">${this.escapeHTML(r.title)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${this.escapeHTML(r.author || '-')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${this.formatResourceTypeName(r.type)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${JalaliDateEngine.toPersianDigits(r.assignedRanges || '-')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${JalaliDateEngine.toPersianDigits(r.completedPages || 0)} از ${JalaliDateEngine.toPersianDigits(r.totalPages || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (docData.incSchedule) {
      html += `
        <h3 style="font-size: 12pt; color: #0f172a; margin-top: 20px;">۳. برنامه جلسات مطالعه و مرورهای تحلیلی</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 5px;">تاریخ</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">ساعت</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">عنوان جلسه و منبع</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">روش فعالیت</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            ${docData.tasks.map(t => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${JalaliDateEngine.toPersianDigits(t.date)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${JalaliDateEngine.toPersianDigits(t.startTime)} (${JalaliDateEngine.toPersianDigits(t.durationMinutes)} د)</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; font-weight: 500;">${this.escapeHTML(t.title)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px;">${this.escapeHTML(t.activityType)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">${t.status === 'completed' ? 'تکمیل' : 'در انتظار'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (docData.incMastery) {
      html += `
        <h3 style="font-size: 12pt; color: #0f172a; margin-top: 20px;">۴. کارنامه تسلط و شاخص آمادگی امتحانات (هدف ۱۸ تا ۲۰)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 6px;">نام درس</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">پوشش صفحات منبع</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">میانگین آزمون‌های آزمایشی</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px;">شاخص کل آمادگی</th>
            </tr>
          </thead>
          <tbody>
            ${docData.masteryData.map(m => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${this.escapeHTML(m.course.name)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${JalaliDateEngine.toPersianDigits(m.completedPages)} از ${JalaliDateEngine.toPersianDigits(m.totalPages)} (${JalaliDateEngine.toPersianDigits(m.pagePct)}٪)</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${m.assessCount > 0 ? `${JalaliDateEngine.toPersianDigits(m.avgScore)} از ۲۰` : 'بدون آزمون'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; color: ${m.readiness >= 75 ? '#047857' : '#b45309'};">${JalaliDateEngine.toPersianDigits(m.readiness)}٪</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    html += `</div>`;
    printContainer.innerHTML = html;
    window.print();
  }

  exportMarkdownDocument() {
    const docData = this.buildExportDocumentData();
    let md = `# ${docData.title}\n\n`;
    md += `**گرایش:** تاریخ ایران دوره اسلامی | **تاریخ گزارش:** ${JalaliDateEngine.toReadablePersianDate(JalaliDateEngine.todayJalali())}\n\n`;

    if (docData.incCourses) {
      md += `## ۱. دروس و امتحانات\n\n`;
      md += `| نام درس | تعداد واحد | روز و ساعت کلاس | تاریخ امتحان پایانی | فرمت ارزیابی | نمره هدف |\n`;
      md += `| :--- | :---: | :---: | :---: | :--- | :---: |\n`;
      docData.courses.forEach(c => {
        md += `| ${c.name} | ${c.units} | ${c.classDay || '-'} ${c.classStartTime || ''} | ${c.examDate || '-'} | ${this.formatExamTypeName(c.examFormat)} | ${c.targetGrade} |\n`;
      });
      md += `\n`;
    }

    if (docData.incResources) {
      md += `## ۲. منابع و متون تاریخی\n\n`;
      md += `| عنوان منبع | نویسنده | نوع منبع | بازه‌های امتحانی | صفحات کل | مطالعه‌شده |\n`;
      md += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;
      docData.resources.forEach(r => {
        md += `| ${r.title} | ${r.author || '-'} | ${r.type} | ${r.assignedRanges} | ${r.totalPages} | ${r.completedPages || 0} |\n`;
      });
      md += `\n`;
    }

    if (docData.incSchedule) {
      md += `## ۳. برنامه عملیاتی جلسات مطالعه\n\n`;
      md += `| تاریخ شمسی | ساعت | عنوان جلسه | روش مطالعه | مدت (دقیقه) | وضعیت |\n`;
      md += `| :---: | :---: | :--- | :--- | :---: | :---: |\n`;
      docData.tasks.forEach(t => {
        md += `| ${t.date} | ${t.startTime} | ${t.title} | ${t.activityType} | ${t.durationMinutes} | ${t.status} |\n`;
      });
      md += `\n`;
    }

    if (docData.incMastery) {
      md += `## ۴. کارنامه تسلط و شاخص آمادگی امتحانات\n\n`;
      md += `| نام درس | پوشش صفحات | میانگین آزمون‌ها | شاخص کل آمادگی |\n`;
      md += `| :--- | :---: | :---: | :---: |\n`;
      docData.masteryData.forEach(m => {
        md += `| ${m.course.name} | ${m.completedPages}/${m.totalPages} (${m.pagePct}%) | ${m.assessCount > 0 ? `${m.avgScore}/20` : 'بدون آزمون'} | ${m.readiness}% |\n`;
      });
      md += `\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic_plan_${JalaliDateEngine.todayJalali().replace(/\//g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('فایل Markdown با موفقیت دانلود شد.', 'success');
  }

  exportICalendarFile() {
    const docData = this.buildExportDocumentData();
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Iran History Academic Planner//FA',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:برنامه تحصیلی تاریخ ایران دوره اسلامی'
    ];

    const todayDate = new Date();
    const dtstamp = todayDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const fmtICS = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      const ss = String(dt.getSeconds()).padStart(2, '0');
      return `${y}${m}${day}T${hh}${mm}${ss}`;
    };

    // افزودن جلسات مطالعه
    docData.tasks.forEach(t => {
      if (!t.date || !JalaliDateEngine.isValidJalaliString(t.date)) return;
      const d = JalaliDateEngine.jalaliToLocalMiddayDate(t.date);
      const [sh, sm] = (t.startTime || '09:00').split(':').map(Number);
      const durationMin = Number(t.durationMinutes) || 60;

      const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, 0);
      const endDate = new Date(startDate.getTime() + durationMin * 60000);

      const crs = this.state.courses.find(c => c.id === t.courseId);
      const courseName = crs ? crs.name : 'درس تاریخ';

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:${t.id}@iran-history-grad-planner`);
      ics.push(`DTSTAMP:${dtstamp}`);
      ics.push(`DTSTART:${fmtICS(startDate)}`);
      ics.push(`DTEND:${fmtICS(endDate)}`);
      ics.push(`SUMMARY:${t.title}`);
      ics.push(`DESCRIPTION:${courseName} - ${t.objective || ''}`);
      ics.push('STATUS:CONFIRMED');
      ics.push('BEGIN:VALARM');
      ics.push('ACTION:DISPLAY');
      ics.push(`DESCRIPTION:یادآوری مطالعه: ${t.title}`);
      ics.push('TRIGGER:-PT10M');
      ics.push('END:VALARM');
      ics.push('END:VEVENT');
    });

    // افزودن امتحانات پایانی
    docData.courses.forEach(c => {
      if (!c.examDate || c.examDate === 'نامشخص' || c.examDate === 'ندارد' || !JalaliDateEngine.isValidJalaliString(c.examDate)) return;
      const d = JalaliDateEngine.jalaliToLocalMiddayDate(c.examDate);
      const [sh, sm] = (c.examTime || '09:00').split(':').map(Number);
      const examStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, 0);
      const examEnd = new Date(examStart.getTime() + 120 * 60000);

      ics.push('BEGIN:VEVENT');
      ics.push(`UID:exam_${c.id}@iran-history-grad-planner`);
      ics.push(`DTSTAMP:${dtstamp}`);
      ics.push(`DTSTART:${fmtICS(examStart)}`);
      ics.push(`DTEND:${fmtICS(examEnd)}`);
      ics.push(`SUMMARY:امتحان نهایی: ${c.name}`);
      ics.push(`DESCRIPTION:امتحان نهایی درس ${c.name} - قالب ارزیابی: ${this.formatExamTypeName(c.examFormat)} - نمره هدف: ${c.targetGrade}`);
      ics.push('STATUS:CONFIRMED');
      ics.push('BEGIN:VALARM');
      ics.push('ACTION:DISPLAY');
      ics.push(`DESCRIPTION:امتحان نهایی: ${c.name}`);
      ics.push('TRIGGER:-P1D');
      ics.push('END:VALARM');
      ics.push('END:VEVENT');
    });

    ics.push('END:VCALENDAR');

    const icsContent = ics.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic_schedule_${JalaliDateEngine.todayJalali().replace(/\//g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('فایل تقویم موبایل (.ics) با موفقیت دانلود شد.', 'success');
  }

  async exportFullBackupJSON() {
    const backupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      todayJalali: JalaliDateEngine.todayJalali(),
      semesters: this.state.semesters,
      courses: this.state.courses,
      resources: this.state.resources,
      tasks: this.state.tasks,
      assessments: this.state.assessments,
      mastery: this.state.mastery,
      forest: this.state.forest || [],
      preferences: this.state.preferences
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iran_history_planner_backup_${JalaliDateEngine.todayJalali().replace(/\//g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('پشتیبان کامل JSON دانلود شد.', 'success');
  }

  async importBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || (!Array.isArray(data.courses) && !Array.isArray(data.tasks))) {
          throw new Error('فرمت فایل پشتیبان نامعتبر است.');
        }

        if (!confirm('آیا از بازگردانی این فایل پشتیبان اطمینان دارید؟ اطلاعات فعلی با اطلاعات فایل جایگزین خواهند شد.')) {
          return;
        }

        await this.db.clearAllStores();

        if (Array.isArray(data.semesters)) {
          for (const item of data.semesters) await this.db.put('semesters', item);
        }
        if (Array.isArray(data.courses)) {
          for (const item of data.courses) await this.db.put('courses', item);
        }
        if (Array.isArray(data.resources)) {
          for (const item of data.resources) await this.db.put('resources', item);
        }
        if (Array.isArray(data.tasks)) {
          for (const item of data.tasks) await this.db.put('tasks', item);
        }
        if (Array.isArray(data.assessments)) {
          for (const item of data.assessments) await this.db.put('assessments', item);
        }
        if (Array.isArray(data.mastery)) {
          for (const item of data.mastery) await this.db.put('mastery', item);
        }
        if (Array.isArray(data.forest)) {
          for (const item of data.forest) await this.db.put('forest', item);
        }

        if (data.preferences) {
          localStorage.setItem('planner_preferences', JSON.stringify(data.preferences));
          this.state.preferences = data.preferences;
        }

        await this.reloadStateFromDB();
        this.renderCurrentView();
        this.showToast('پایگاه داده با موفقیت از فایل پشتیبان بازگردانی شد.', 'success');
      } catch (err) {
        this.showToast(`خطا در بازگردانی پشتیبان: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  async confirmWipeDatabase() {
    const promptInput = prompt('هشدار حذف کامل: برای تایید پاکسازی کلیه داده‌های محلی، کلمه «حذف» را تایپ فرمایید:');
    if (promptInput === 'حذف') {
      await this.db.clearAllStores();
      await this.reloadStateFromDB();
      this.renderCurrentView();
      this.showToast('تمامی رکوردهای محلی پاکسازی شدند.', 'warning');
    }
  }

  /***********************************************************************
   * ۹. تنظیمات و پیکربندی Gemini API
   ***********************************************************************/
  populateSettingsForm() {
    const p = this.state.preferences;
    const prefWakeStart = document.getElementById('pref-wake-start');
    if (prefWakeStart) prefWakeStart.value = p.wakingStart || '08:00';
    const prefWakeEnd = document.getElementById('pref-wake-end');
    if (prefWakeEnd) prefWakeEnd.value = p.wakingEnd || '22:00';
    const prefDailyMax = document.getElementById('pref-daily-max');
    if (prefDailyMax) prefDailyMax.value = p.dailyMaxHours || 6;
    const prefWeeklyMax = document.getElementById('pref-weekly-max');
    if (prefWeeklyMax) prefWeeklyMax.value = p.weeklyMaxHours || 36;
    const prefSessionLen = document.getElementById('pref-session-len');
    if (prefSessionLen) prefSessionLen.value = String(p.sessionDurationMinutes || 75);
    const prefBuffer = document.getElementById('pref-buffer');
    if (prefBuffer) prefBuffer.value = String(p.bufferPercent || 20);
    const prefCommitments = document.getElementById('pref-commitments');
    if (prefCommitments) prefCommitments.value = p.commitments || '';

    const cfg = this.ai.getConfig();
    const apiKeyEl = document.getElementById('gemini-api-key');
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey;
    const modelEl = document.getElementById('gemini-model-id');
    if (modelEl) {
      const optionExists = Array.from(modelEl.options).some(o => o.value === cfg.model);
      modelEl.value = optionExists ? cfg.model : 'gemini-3.8-flash';
    }
    const storageModeEl = document.getElementById('gemini-storage-mode');
    if (storageModeEl) storageModeEl.value = cfg.storageMode;

    this.updateAIStatusIndicator();
  }

  saveUserPreferences(event) {
    event.preventDefault();
    this.state.preferences = {
      wakingStart: document.getElementById('pref-wake-start').value,
      wakingEnd: document.getElementById('pref-wake-end').value,
      dailyMaxHours: Number(document.getElementById('pref-daily-max').value) || 6,
      weeklyMaxHours: Number(document.getElementById('pref-weekly-max').value) || 36,
      sessionDurationMinutes: Number(document.getElementById('pref-session-len').value) || 75,
      bufferPercent: Number(document.getElementById('pref-buffer').value) || 20,
      commitments: document.getElementById('pref-commitments').value.trim(),
      timezone: 'Asia/Tehran'
    };
    localStorage.setItem('planner_preferences', JSON.stringify(this.state.preferences));
    this.touchLocalUpdate();
    this.showToast('تنظیمات ظرفیت مطالعه ذخیره شد.', 'success');
  }

  saveGeminiConfig(event) {
    event.preventDefault();
    const apiKey = document.getElementById('gemini-api-key').value.trim();
    const model = document.getElementById('gemini-model-id').value;
    const storageMode = document.getElementById('gemini-storage-mode').value;

    this.ai.saveConfig({ apiKey, model, storageMode });
    this.updateAIStatusIndicator();
    this.showToast('تنظیمات Gemini API ذخیره شد.', 'success');
  }

  clearGeminiKey() {
    this.ai.clearKey();
    document.getElementById('gemini-api-key').value = '';
    this.updateAIStatusIndicator();
    this.showToast('کلید API با موفقیت حذف گردید.', 'info');
  }

  async testGeminiConnection() {
    const keyInput = document.getElementById('gemini-api-key')?.value.trim();
    const modelInput = document.getElementById('gemini-model-id')?.value;
    const cfg = this.ai.getConfig();
    const apiKey = keyInput || cfg.apiKey;
    const model = modelInput || cfg.model || 'gemini-3.8-flash';

    if (!apiKey) {
      this.showToast('لطفاً ابتدا کلید API را در کادر وارد فرمایید.', 'error');
      return;
    }

    this.showToast(`در حال بررسی اتصال به Google Gemini با مدل ${model}...`, 'info');
    try {
      await this.ai.testConnection(apiKey, model);
      const storageMode = document.getElementById('gemini-storage-mode')?.value || 'session';
      this.ai.saveConfig({ apiKey, model, storageMode });
      this.updateAIStatusIndicator(true);
      this.showToast(`اتصال به Google Gemini API با مدل «${model}» با موفقیت برقرار شد.`, 'success');
    } catch (err) {
      this.showToast(`خطای اتصال به Gemini: ${err.message}`, 'error');
      this.updateAIStatusIndicator(false);
    }
  }

  updateAIStatusIndicator(isVerified) {
    const dot = document.getElementById('ai-status-dot');
    const text = document.getElementById('ai-status-text');
    const cfg = this.ai.getConfig();

    if (!dot || !text) return;

    if (!cfg.apiKey) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
      text.textContent = 'Gemini (آفلاین)';
    } else if (isVerified === true) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
      text.textContent = `Gemini (فعال: ${cfg.model})`;
    } else if (isVerified === false) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      text.textContent = 'خطای اتصال API';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
      text.textContent = `Gemini (${cfg.model})`;
    }
  }

  /***********************************************************************
   * ۱۰. موتور زمانبندی قطعی و مودال اعتبارسنجی برنامه
   ***********************************************************************/
  runScheduleEngineModal() {
    if (this.state.courses.length === 0) {
      this.showToast('ابتدا حداقل یک درس ثبت کنید تا برنامه مطالعه تولید شود.', 'warning');
      this.navigate('courses');
      return;
    }

    const todayJ = JalaliDateEngine.todayJalali();
    const planResult = DeterministicScheduler.generatePlan({
      courses: this.state.courses,
      resources: this.state.resources,
      existingTasks: this.state.tasks,
      masteryList: this.state.mastery,
      preferences: this.state.preferences,
      startDateJalali: todayJ,
      horizonDays: 21
    });

    this.state.lastSchedulePreview = planResult;

    const modalBody = document.getElementById('schedule-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <div class="text-slate-500 text-[11px]">ساعات کار مورد نیاز</div>
            <div class="text-base font-bold text-slate-900">${JalaliDateEngine.toPersianDigits(planResult.totalRequiredHours.toFixed(1))} ساعت</div>
          </div>
          <div>
            <div class="text-slate-500 text-[11px]">ظرفیت قابل برنامه‌ریزی</div>
            <div class="text-base font-bold text-slate-900">${JalaliDateEngine.toPersianDigits(planResult.netCapacityHours.toFixed(1))} ساعت</div>
          </div>
          <div>
            <div class="text-slate-500 text-[11px]">جلسات جدید تولیدشده</div>
            <div class="text-base font-bold text-emerald-700">${JalaliDateEngine.toPersianDigits(planResult.generatedTasks.length)} جلسه</div>
          </div>
          <div>
            <div class="text-slate-500 text-[11px]">جلسات تکمیل‌شده قبلی</div>
            <div class="text-base font-bold text-sky-700">${JalaliDateEngine.toPersianDigits(planResult.completedTasksPreserved)} جلسه (حفظ کامل)</div>
          </div>
        </div>

        ${planResult.conflicts.length > 0 ? `
          <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-1">
            <h4 class="font-bold text-rose-900 text-xs">تعارض‌های ظرفیت مطالعه:</h4>
            ${planResult.conflicts.map(c => `<p class="text-rose-800 text-xs">• ${this.escapeHTML(c)}</p>`).join('')}
          </div>
        ` : ''}

        ${planResult.warnings.length > 0 ? `
          <div class="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
            <h4 class="font-bold text-amber-900 text-xs">هشدارهای زمانبندی:</h4>
            ${planResult.warnings.map(w => `<p class="text-amber-800 text-xs">• ${this.escapeHTML(w)}</p>`).join('')}
          </div>
        ` : ''}

        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs">پیش‌نمایش جلسات برنامه‌ریزی‌شده در افق ۲۱ روزه:</h4>
          <div class="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
            ${planResult.generatedTasks.slice(0, 30).map(t => `
              <div class="p-2 rounded bg-white border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span class="font-bold text-slate-900">${this.escapeHTML(t.title)}</span>
                  <span class="text-slate-500 text-[11px] mr-2">(${JalaliDateEngine.toReadablePersianDate(t.date)})</span>
                </div>
                <span class="text-slate-600 text-[11px] font-mono">${JalaliDateEngine.toPersianDigits(t.startTime)} تا ${JalaliDateEngine.toPersianDigits(t.endTime)}</span>
              </div>
            `).join('')}
            ${planResult.generatedTasks.length > 30 ? `<div class="text-center text-xs text-slate-500 py-1">و ${JalaliDateEngine.toPersianDigits(planResult.generatedTasks.length - 30)} جلسه دیگر...</div>` : ''}
          </div>
        </div>
      </div>
    `;

    document.getElementById('schedule-modal').classList.remove('hidden');
    document.getElementById('schedule-modal').classList.add('flex');
  }

  closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
    document.getElementById('schedule-modal').classList.remove('flex');
  }

  async commitProposedSchedule() {
    if (!this.state.lastSchedulePreview) return;
    const { generatedTasks } = this.state.lastSchedulePreview;

    // حذف صرفاً وظایف pending خودکار قبلی و حفظ کامل جلسات completed, partial, missed, cancelled و دستی (isManual)
    const tasksToKeep = this.state.tasks.filter(t =>
      t.status === 'completed' ||
      t.status === 'partial' ||
      t.status === 'missed' ||
      t.status === 'cancelled' ||
      t.isManual === true
    );

    await this.db.clearStore('tasks');
    for (const t of tasksToKeep) {
      await this.db.put('tasks', t);
    }
    for (const t of generatedTasks) {
      await this.db.put('tasks', t);
    }

    this.state.tasks = [...tasksToKeep, ...generatedTasks];
    this.closeScheduleModal();
    this.showToast(`برنامه جدید با موفقیت اعمال شد (${JalaliDateEngine.toPersianDigits(generatedTasks.length)} جلسه ثبت شد).`, 'success');
    this.renderCurrentView();
  }

  /***********************************************************************
   * ۱۱. کنترلر پومودورو، آلارم‌های صوتی و همگام‌سازی شبکه
   ***********************************************************************/
  openPomodoroModal(taskId = null) {
    this.pomodoro.openModal(taskId);
  }

  closePomodoroModal() {
    this.pomodoro.closeModal();
  }

  setPomodoroPreset(workMin, breakMin) {
    this.pomodoro.setPreset(workMin, breakMin);
  }

  togglePomodoro() {
    this.pomodoro.toggleTimer();
  }

  giveUpPomodoro() {
    this.pomodoro.giveUp();
  }

  skipPomodoroPhase() {
    this.pomodoro.skipPhase();
  }

  toggleSoundMute() {
    return this.sound.toggleMute();
  }

  showCalendarAlarmModal(task) {
    this.pendingAlarmTask = task;
    const crs = this.state.courses.find(c => c.id === task.courseId);
    const modal = document.getElementById('alarm-modal');
    if (!modal) return;

    const subtitleEl = document.getElementById('alarm-time-subtitle');
    if (subtitleEl) subtitleEl.textContent = `طبق جدول زمانبندی امروز (${JalaliDateEngine.toReadablePersianDate(task.date)})`;

    const titleEl = document.getElementById('alarm-course-title');
    if (titleEl) titleEl.textContent = crs ? crs.name : 'درس تخصصی تاریخ ایران';

    const objEl = document.getElementById('alarm-task-objective');
    if (objEl) objEl.textContent = task.objective || task.title;

    const timeEl = document.getElementById('alarm-task-time');
    if (timeEl) timeEl.textContent = `${JalaliDateEngine.toPersianDigits(task.startTime)} تا ${JalaliDateEngine.toPersianDigits(task.endTime)} (${JalaliDateEngine.toPersianDigits(task.durationMinutes)} دقیقه)`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  startAlarmTaskWithPomodoro() {
    const task = this.pendingAlarmTask;
    this.dismissAlarm();
    if (task) {
      this.openPomodoroModal(task.id);
    }
  }

  snoozeAlarm() {
    const task = this.pendingAlarmTask;
    this.dismissAlarm();
    this.showToast('یادآوری ۵ دقیقه دیگر تکرار خواهد شد.', 'info');
    if (task) {
      setTimeout(() => {
        const stillPending = this.state.tasks.find(t => t.id === task.id && t.status === 'pending');
        if (stillPending) {
          this.sound.triggerTaskAlarm(stillPending);
        }
      }, 5 * 60 * 1000);
    }
  }

  dismissAlarm() {
    const modal = document.getElementById('alarm-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.pendingAlarmTask = null;
  }

  /***********************************************************************
   * ۱۲. بوم داینامیک جنگل زنده و اکوسیستم حیوانات (Living Forest Gamification)
   ***********************************************************************/
  toggleForestCollapse() {
    const body = document.getElementById('forest-body');
    const btn = document.getElementById('btn-toggle-forest');
    if (!body) return;
    const isHidden = body.classList.toggle('hidden');
    if (btn) btn.textContent = isHidden ? '▲' : '▼';
  }

  renderForestView() {
    const container = document.getElementById('forest-container');
    if (!container) return;

    const now = new Date();
    const curHour = now.getHours();

    // تعیین وضعیت آسمان بر مبنای ساعت جاری تهران
    let timeName = 'روز آفتابی';
    let timeIcon = '☀️';
    let skyBg = 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #bae6fd 75%, #e0f2fe 100%)';

    if (curHour >= 6 && curHour < 17) {
      timeName = 'روز آفتابی';
      timeIcon = '☀️';
      skyBg = 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #bae6fd 75%, #e0f2fe 100%)';
    } else if (curHour >= 17 && curHour < 19) {
      timeName = 'غروب زرین البرز';
      timeIcon = '🌅';
      skyBg = 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 30%, #c026d3 65%, #f97316 85%, #fde047 100%)';
    } else {
      timeName = 'شب مهتابی پر ستاره';
      timeIcon = '🌙';
      skyBg = 'linear-gradient(180deg, #020617 0%, #0f172a 40%, #1e1b4b 80%, #1e293b 100%)';
    }

    const iconEl = document.getElementById('forest-time-icon');
    if (iconEl) iconEl.textContent = timeIcon;
    const badgeEl = document.getElementById('forest-time-badge');
    if (badgeEl) badgeEl.textContent = timeName;

    const skyCanvas = document.getElementById('forest-sky-canvas');
    if (skyCanvas) skyCanvas.style.background = skyBg;

    // محاسبات آماری درختان و ساعات متمرکز
    const trees = this.state.forest || [];
    const treeCount = trees.length;
    const totalPomodoroMin = trees.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);
    const totalHours = totalPomodoroMin / 60;

    let ecosystemLevel = 1;
    let levelBadgeText = 'سطح ۱: آغاز رویش';
    let animalText = 'پروانه‌ها و نسیم بهاری';
    let nextLabel = '';
    let progressPct = 0;

    if (totalHours < 5) {
      ecosystemLevel = 1;
      levelBadgeText = 'سطح ۱: آغاز رویش';
      animalText = 'پروانه‌ها و نسیم بهاری';
      const rem = Math.max(0, 5 - totalHours);
      nextLabel = `تا باز شدن پرندگان نغمه‌خوان (سطح ۲): ${JalaliDateEngine.toPersianDigits(rem.toFixed(1))} ساعت`;
      progressPct = Math.min(100, Math.round((totalHours / 5) * 100));
    } else if (totalHours < 15) {
      ecosystemLevel = 2;
      levelBadgeText = 'سطح ۲: بیشه‌زار پویا';
      animalText = 'پرندگان نغمه‌خوان البرز و پروانه‌ها';
      const rem = Math.max(0, 15 - totalHours);
      nextLabel = `تا باز شدن رودخانه و خرگوش‌ها (سطح ۳): ${JalaliDateEngine.toPersianDigits(rem.toFixed(1))} ساعت`;
      progressPct = Math.min(100, Math.round(((totalHours - 5) / 10) * 100));
    } else if (totalHours < 30) {
      ecosystemLevel = 3;
      levelBadgeText = 'سطح ۳: زیستگاه خرم';
      animalText = 'رودبار جاری، خرگوش‌ها و سنجاب‌های زرنگ';
      const rem = Math.max(0, 30 - totalHours);
      nextLabel = `تا جنگل باستانی هیرکانی و گوزن مارال (سطح ۴): ${JalaliDateEngine.toPersianDigits(rem.toFixed(1))} ساعت`;
      progressPct = Math.min(100, Math.round(((totalHours - 15) / 15) * 100));
    } else {
      ecosystemLevel = 4;
      levelBadgeText = 'سطح ۴: جنگل باستانی هیرکانی';
      animalText = 'گوزن اصیل مارال، روباه سرخ ایرانی، پرندگان و رودبار جاری';
      nextLabel = 'اکوسیستم در اوج شکوفایی و بالندگی باستانی!';
      progressPct = 100;
    }

    const cntTreesEl = document.getElementById('forest-count-trees');
    if (cntTreesEl) cntTreesEl.textContent = JalaliDateEngine.toPersianDigits(treeCount);
    const hrsEl = document.getElementById('forest-total-pomodoro-hours');
    if (hrsEl) hrsEl.textContent = `${JalaliDateEngine.toPersianDigits(totalHours.toFixed(1))} ساعت`;
    const lvlBadge = document.getElementById('forest-level-badge');
    if (lvlBadge) lvlBadge.textContent = levelBadgeText;
    const anmEl = document.getElementById('forest-unlocked-animals');
    if (anmEl) anmEl.textContent = animalText;
    const nextEl = document.getElementById('forest-next-unlock-label');
    if (nextEl) nextEl.textContent = nextLabel;
    const barEl = document.getElementById('forest-level-progress-bar');
    if (barEl) barEl.style.width = `${progressPct}%`;

    // رندر پانورامای SVG جنگل
    const viewport = document.getElementById('forest-viewport');
    if (viewport) {
      const minW = Math.max(860, (treeCount + 2) * 85);
      viewport.innerHTML = this.buildForestPanoramaSVG(trees, ecosystemLevel, curHour, minW);
    }
  }

  buildForestPanoramaSVG(trees, level, hour, width) {
    const height = 240;
    const isNight = hour >= 19 || hour < 6;
    const isSunset = hour >= 17 && hour < 19;
    const isDay = !isNight && !isSunset;

    let celestialSVG = '';
    if (isDay) {
      celestialSVG = `
        <circle cx="85" cy="50" r="28" fill="#fef08a" opacity="0.4"/>
        <circle cx="85" cy="50" r="20" fill="#fbbf24"/>
        <g stroke="#fde047" stroke-width="2" stroke-linecap="round" opacity="0.6">
          <line x1="85" y1="22" x2="85" y2="15"/>
          <line x1="85" y1="78" x2="85" y2="85"/>
          <line x1="57" y1="50" x2="50" y2="50"/>
          <line x1="113" y1="50" x2="120" y2="50"/>
        </g>
      `;
    } else if (isSunset) {
      celestialSVG = `
        <circle cx="${width - 120}" cy="130" r="32" fill="#fb923c" opacity="0.8"/>
        <circle cx="${width - 120}" cy="130" r="24" fill="#ef4444"/>
      `;
    } else {
      celestialSVG = `
        <circle cx="${width - 100}" cy="45" r="24" fill="#fef08a" opacity="0.3"/>
        <path d="M ${width - 90} 25 A 22 22 0 1 0 ${width - 90} 65 A 18 18 0 1 1 ${width - 90} 25 Z" fill="#fef08a"/>
        <g fill="#ffffff" opacity="0.85">
          <circle cx="60" cy="30" r="1.5"/>
          <circle cx="120" cy="50" r="1.2"/>
          <circle cx="190" cy="25" r="2"/>
          <circle cx="280" cy="40" r="1"/>
          <circle cx="360" cy="20" r="1.8"/>
          <circle cx="450" cy="55" r="1.5"/>
          <circle cx="530" cy="35" r="1.2"/>
          <circle cx="620" cy="25" r="2"/>
          <circle cx="710" cy="45" r="1.5"/>
          <circle cx="790" cy="30" r="1"/>
        </g>
      `;
    }

    const mountainFill = isNight ? '#091322' : (isSunset ? '#311042' : '#334155');
    const mountainsSVG = `
      <polygon points="0,${height} 0,140 90,95 210,150 340,80 480,145 610,85 750,150 ${width},90 ${width},${height}" fill="${mountainFill}" opacity="0.35"/>
      <polygon points="0,${height} 0,160 140,115 280,165 420,110 560,170 700,105 840,160 ${width},125 ${width},${height}" fill="${mountainFill}" opacity="0.55"/>
    `;

    let cloudsSVG = '';
    if (!isNight) {
      cloudsSVG = `
        <g class="animate-cloud-float" fill="#ffffff" opacity="0.55">
          <ellipse cx="220" cy="48" rx="42" ry="14"/>
          <ellipse cx="240" cy="40" rx="25" ry="16"/>
          <ellipse cx="620" cy="60" rx="55" ry="16"/>
          <ellipse cx="645" cy="50" rx="30" ry="18"/>
        </g>
      `;
    }

    const grassGradient = isNight
      ? '<linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#064e3b"/><stop offset="100%" stop-color="#022c22"/></linearGradient>'
      : '<linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#166534"/></linearGradient>';

    const groundY = 175;
    const groundSVG = `
      <path d="M 0 ${groundY} Q ${width * 0.25} ${groundY - 15} ${width * 0.5} ${groundY} T ${width} ${groundY} L ${width} ${height} L 0 ${height} Z" fill="url(#grassGrad)"/>
      <line x1="0" y1="${groundY + 1}" x2="${width}" y2="${groundY + 1}" stroke="#14532d" stroke-width="2"/>
    `;

    let riverSVG = '';
    if (level >= 3) {
      riverSVG = `
        <path d="M ${width - 240} ${height} Q ${width - 180} ${groundY + 25} ${width - 100} ${groundY + 15} T ${width} ${groundY + 30} L ${width} ${height} Z" fill="#38bdf8" opacity="0.8"/>
        <path d="M ${width - 220} ${height} Q ${width - 170} ${groundY + 30} ${width - 90} ${groundY + 20} T ${width} ${groundY + 35} L ${width} ${height} Z" fill="#0284c7" opacity="0.6"/>
      `;
    }

    let butterfliesSVG = '';
    if (level >= 1 && !isNight) {
      butterfliesSVG = `
        <g class="animate-flutter">
          <g transform="translate(180, 115) scale(0.9)">
            <ellipse cx="0" cy="0" rx="5" ry="8" fill="#c084fc" transform="rotate(-30)"/>
            <ellipse cx="5" cy="0" rx="5" ry="8" fill="#a855f7" transform="rotate(30)"/>
            <circle cx="2.5" cy="0" r="1.5" fill="#4c1d95"/>
          </g>
          <g transform="translate(390, 100) scale(0.8)">
            <ellipse cx="0" cy="0" rx="5" ry="8" fill="#fde047" transform="rotate(-25)"/>
            <ellipse cx="5" cy="0" rx="5" ry="8" fill="#eab308" transform="rotate(25)"/>
            <circle cx="2.5" cy="0" r="1.5" fill="#713f12"/>
          </g>
        </g>
      `;
    }

    let birdsSVG = '';
    if (level >= 2) {
      birdsSVG = `
        <g stroke="${isNight ? '#cbd5e1' : '#1e293b'}" stroke-width="1.8" fill="none" stroke-linecap="round">
          <path d="M 290 60 Q 297 53 304 60 Q 311 53 318 60"/>
          <path d="M 325 72 Q 330 66 336 72 Q 342 66 348 72"/>
          <path d="M 480 50 Q 486 44 493 50 Q 500 44 507 50"/>
        </g>
      `;
    }

    let rabbitsSVG = '';
    if (level >= 3) {
      rabbitsSVG = `
        <g class="animate-hop">
          <g transform="translate(${width - 270}, ${groundY + 12}) scale(0.85)">
            <ellipse cx="12" cy="12" rx="10" ry="7" fill="#f8fafc"/>
            <circle cx="2" cy="12" r="3" fill="#ffffff"/>
            <circle cx="20" cy="8" r="5" fill="#f8fafc"/>
            <ellipse cx="19" cy="1" rx="2" ry="6" fill="#f8fafc"/>
            <ellipse cx="19" cy="1" rx="1" ry="4" fill="#fbcfe8"/>
            <ellipse cx="22" cy="2" rx="1.8" ry="5.5" fill="#f8fafc"/>
            <circle cx="22" cy="7" r="1" fill="#be185d"/>
          </g>
        </g>
      `;
    }

    let majesticFaunaSVG = '';
    if (level >= 4) {
      majesticFaunaSVG = `
        <!-- گوزن مارال البرز -->
        <g transform="translate(60, ${groundY - 32}) scale(0.95)">
          <path d="M 20 4 L 18 -8 M 18 -4 L 13 -7 M 18 -6 L 22 -11 M 23 4 L 26 -7 M 26 -3 L 31 -6" stroke="#522e11" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="22" cy="8" rx="6" ry="4.5" fill="#854d0e"/>
          <polygon points="26,6 30,8 26,10" fill="#713f12"/>
          <circle cx="24" cy="7" r="1" fill="#000000"/>
          <ellipse cx="18" cy="5" rx="3" ry="1.5" fill="#713f12" transform="rotate(-30 18 5)"/>
          <path d="M 17 9 L 10 22 L 14 24 L 21 11 Z" fill="#854d0e"/>
          <ellipse cx="5" cy="26" rx="16" ry="10" fill="#a16207"/>
          <path d="M -11 24 Q -14 26 -12 29" stroke="#713f12" stroke-width="3" stroke-linecap="round"/>
          <line x1="-5" y1="34" x2="-6" y2="52" stroke="#713f12" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="2" y1="34" x2="3" y2="52" stroke="#713f12" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="12" y1="33" x2="13" y2="52" stroke="#713f12" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="17" y1="32" x2="19" y2="52" stroke="#713f12" stroke-width="2.2" stroke-linecap="round"/>
        </g>

        <!-- روباه سرخ ایرانی -->
        <g transform="translate(135, ${groundY + 8}) scale(0.8)">
          <ellipse cx="14" cy="10" rx="11" ry="6" fill="#ea580c"/>
          <path d="M 3 11 C -4 12, -8 7, -6 2 C -5 6, -1 9, 3 10 Z" fill="#ea580c"/>
          <circle cx="-5" cy="3" r="2.5" fill="#ffffff"/>
          <polygon points="24,6 30,10 23,13" fill="#ea580c"/>
          <polygon points="24,10 30,10 24,12" fill="#ffffff"/>
          <polygon points="24,6 23,1 27,5" fill="#7c2d12"/>
          <polygon points="26,6 27,2 29,6" fill="#7c2d12"/>
          <circle cx="26" cy="8" r="0.9" fill="#000000"/>
          <circle cx="30" cy="10" r="0.9" fill="#000000"/>
          <line x1="9" y1="15" x2="9" y2="23" stroke="#9a3412" stroke-width="2"/>
          <line x1="19" y1="15" x2="19" y2="23" stroke="#9a3412" stroke-width="2"/>
        </g>
      `;
    }

    let floraSVG = '';
    if (trees.length === 0) {
      floraSVG = `
        <g transform="translate(${width / 2 - 20}, ${groundY - 10})">
          <ellipse cx="20" cy="16" rx="14" ry="4" fill="#064e3b" opacity="0.4"/>
          <path d="M 20 16 Q 20 6 20 0" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
          <ellipse cx="15" cy="-2" rx="6" ry="3" fill="#4ade80" transform="rotate(-30 15 -2)"/>
          <ellipse cx="25" cy="-2" rx="6" ry="3" fill="#22c55e" transform="rotate(30 25 -2)"/>
        </g>
        <text x="${width / 2}" y="${groundY + 36}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="bold" opacity="0.95">
          هنوز درختی در جنگل کاشته نشده است! اولین جلسه پومودورو را با دکمه بالا آغاز کنید تا بذر دانش جوانه بزند.
        </text>
      `;
    } else {
      const stepX = Math.max(75, Math.floor((width - 120) / (trees.length + 1)));
      trees.forEach((tr, idx) => {
        const xPos = 60 + idx * stepX;
        const yPos = groundY;
        const plantSVG = this.renderSinglePlantSVG(tr, xPos, yPos, idx);
        floraSVG += plantSVG;
      });
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="select-none min-w-full">
        <defs>
          ${grassGradient}
        </defs>
        ${celestialSVG}
        ${mountainsSVG}
        ${cloudsSVG}
        ${groundSVG}
        ${riverSVG}
        ${butterfliesSVG}
        ${birdsSVG}
        ${rabbitsSVG}
        ${majesticFaunaSVG}
        ${floraSVG}
      </svg>
    `;
  }

  renderSinglePlantSVG(plant, x, y, idx) {
    const kind = plant.plantKind || 'tree';
    const type = plant.treeType || 'cypress';

    let shape = '';
    if (kind === 'flower') {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="8" ry="2.5" fill="#064e3b" opacity="0.5"/>
        <path d="M ${x} ${y + 2} Q ${x - 3} ${y - 12} ${x} ${y - 24}" stroke="#15803d" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M ${x - 1} ${y - 10} Q ${x - 10} ${y - 16} ${x - 8} ${y - 8}" fill="#22c55e"/>
        <path d="M ${x} ${y - 24} C ${x - 8} ${y - 36}, ${x - 6} ${y - 42}, ${x} ${y - 38} C ${x + 6} ${y - 42}, ${x + 8} ${y - 36}, ${x} ${y - 24} Z" fill="#f43f5e"/>
        <path d="M ${x} ${y - 24} C ${x - 4} ${y - 35}, ${x + 4} ${y - 35}, ${x} ${y - 24} Z" fill="#fda4af"/>
      `;
    } else if (kind === 'sapling') {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="10" ry="3" fill="#064e3b" opacity="0.5"/>
        <path d="M ${x} ${y + 2} L ${x} ${y - 32}" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
        <path d="M ${x} ${y - 18} Q ${x - 12} ${y - 25} ${x - 14} ${y - 32}" stroke="#15803d" stroke-width="2" fill="none"/>
        <path d="M ${x} ${y - 22} Q ${x + 12} ${y - 28} ${x + 14} ${y - 34}" stroke="#15803d" stroke-width="2" fill="none"/>
        <ellipse cx="${x - 14}" cy="${y - 32}" rx="5" ry="3" fill="#4ade80" transform="rotate(-30 ${x - 14} ${y - 32})"/>
        <ellipse cx="${x + 14}" cy="${y - 34}" rx="5" ry="3" fill="#22c55e" transform="rotate(30 ${x + 14} ${y - 34})"/>
        <ellipse cx="${x}" cy="${y - 34}" rx="6" ry="4" fill="#86efac"/>
      `;
    } else if (type === 'cypress') {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="12" ry="3" fill="#064e3b" opacity="0.5"/>
        <rect x="${x - 3}" y="${y - 14}" width="6" height="16" fill="#78350f" rx="1.5"/>
        <path d="M ${x} ${y - 75} C ${x + 15} ${y - 50}, ${x + 18} ${y - 20}, ${x + 10} ${y - 12} L ${x - 10} ${y - 12} C ${x - 18} ${y - 20}, ${x - 15} ${y - 50}, ${x} ${y - 75} Z" fill="#047857"/>
        <path d="M ${x} ${y - 75} C ${x + 8} ${y - 50}, ${x + 10} ${y - 20}, ${x} ${y - 12} L ${x - 10} ${y - 12} C ${x - 18} ${y - 20}, ${x - 15} ${y - 50}, ${x} ${y - 75} Z" fill="#065f46" opacity="0.75"/>
      `;
    } else if (type === 'plane') {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="16" ry="4" fill="#064e3b" opacity="0.5"/>
        <path d="M ${x - 5} ${y + 2} L ${x - 4} ${y - 26} L ${x + 4} ${y - 26} L ${x + 5} ${y + 2} Z" fill="#78350f"/>
        <line x1="${x - 3}" y1="${y - 20}" x2="${x - 12}" y2="${y - 32}" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="${x + 3}" y1="${y - 20}" x2="${x + 12}" y2="${y - 32}" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y - 48}" r="22" fill="#15803d"/>
        <circle cx="${x - 16}" cy="${y - 40}" r="15" fill="#166534"/>
        <circle cx="${x + 16}" cy="${y - 40}" r="15" fill="#15803d"/>
        <circle cx="${x}" cy="${y - 55}" r="14" fill="#22c55e" opacity="0.85"/>
      `;
    } else if (type === 'oak') {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="15" ry="4" fill="#064e3b" opacity="0.5"/>
        <rect x="${x - 4}" y="${y - 22}" width="8" height="24" fill="#582f0e" rx="1.5"/>
        <path d="M ${x - 3} ${y - 16} Q ${x - 14} ${y - 24} ${x - 18} ${y - 35}" stroke="#582f0e" stroke-width="3" fill="none"/>
        <path d="M ${x + 3} ${y - 16} Q ${x + 14} ${y - 24} ${x + 18} ${y - 35}" stroke="#582f0e" stroke-width="3" fill="none"/>
        <ellipse cx="${x}" cy="${y - 46}" rx="26" ry="20" fill="#1e3a1e"/>
        <ellipse cx="${x}" cy="${y - 48}" rx="22" ry="16" fill="#2d6a4f"/>
        <circle cx="${x - 12}" cy="${y - 45}" r="12" fill="#40916c"/>
        <circle cx="${x + 12}" cy="${y - 45}" r="12" fill="#52b788"/>
      `;
    } else {
      shape = `
        <ellipse cx="${x}" cy="${y + 2}" rx="13" ry="3.5" fill="#064e3b" opacity="0.5"/>
        <rect x="${x - 3}" y="${y - 20}" width="6" height="22" fill="#78350f" rx="1"/>
        <circle cx="${x}" cy="${y - 42}" r="20" fill="#166534"/>
        <circle cx="${x}" cy="${y - 44}" r="17" fill="#15803d"/>
        <circle cx="${x - 8}" cy="${y - 46}" r="11" fill="#22c55e" opacity="0.9"/>
        <circle cx="${x - 7}" cy="${y - 38}" r="3" fill="#ea580c"/>
        <circle cx="${x + 8}" cy="${y - 42}" r="3" fill="#f97316"/>
        <circle cx="${x}" cy="${y - 50}" r="2.8" fill="#fb923c"/>
        <circle cx="${x + 4}" cy="${y - 34}" r="2.5" fill="#ea580c"/>
      `;
    }

    return `
      <g class="cursor-pointer transition-transform hover:scale-110" onmouseenter="app.showTreeTooltip(event, ${idx})" onmouseleave="app.hideTreeTooltip()">
        ${shape}
      </g>
    `;
  }

  showTreeTooltip(event, idx) {
    const tooltip = document.getElementById('forest-tree-tooltip');
    const container = document.getElementById('forest-sky-canvas');
    if (!tooltip || !container) return;

    const plant = (this.state.forest || [])[idx];
    if (!plant) return;

    const typeNames = {
      flower: 'گل لاله تاریخی',
      sapling: 'نهال بارور',
      cypress: 'سرو آزاد شیراز',
      plane: 'چنار کهنسال پایتخت',
      oak: 'بلوط استوار زاگرس',
      orange: 'درخت نارنج شیراز'
    };

    const typeLabel = typeNames[plant.treeType] || typeNames[plant.plantKind] || 'درخت دانش';

    tooltip.innerHTML = `
      <div class="font-bold text-amber-300 border-b border-slate-700 pb-1 mb-1 flex items-center justify-between gap-3">
        <span>🌱 ${this.escapeHTML(typeLabel)}</span>
        <span class="text-[10px] text-slate-300">${JalaliDateEngine.toPersianDigits(plant.durationMinutes)} دقیقه تمرکز</span>
      </div>
      <div class="space-y-0.5 text-[10px]">
        <div><strong class="text-slate-300">جلسه:</strong> ${this.escapeHTML(plant.taskTitle || 'نشست پومودورو')}</div>
        <div><strong class="text-slate-300">درس:</strong> ${this.escapeHTML(plant.courseName || 'مطالعه آزاد')}</div>
        <div><strong class="text-slate-300">تاریخ کاشت:</strong> ${JalaliDateEngine.toReadablePersianDate(plant.dateJalali)}</div>
      </div>
    `;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    tooltip.style.left = `${Math.min(rect.width - 200, Math.max(10, x - 80))}px`;
    tooltip.style.top = `${Math.max(10, y - 90)}px`;
    tooltip.classList.remove('hidden');
  }

  hideTreeTooltip() {
    const tooltip = document.getElementById('forest-tree-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
  }

  touchLocalUpdate() {
    localStorage.setItem('planner_last_local_update', String(Date.now()));
  }

  /***********************************************************************
   * ۱۳. همگام‌سازی شبکه محلی (LAN Sync) با سرور پایتون
   ***********************************************************************/
  async syncWithLANServer(silent = true) {
    const dot = document.getElementById('lan-sync-dot');
    const syncUrl = window.location.protocol.startsWith('http')
      ? '/api/sync'
      : 'http://localhost:8080/api/sync';

    try {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';

      // ۱. خواندن وضعیت فایل ذخیره‌شده از سرور
      const getRes = await fetch(syncUrl, { cache: 'no-store' });
      if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
      const serverData = await getRes.json();

      const lastLocalUpdate = Number(localStorage.getItem('planner_last_local_update') || 0);
      const serverUpdatedAt = (serverData && serverData.updatedAt) ? new Date(serverData.updatedAt).getTime() : 0;
      const localHasData = (this.state.courses.length > 0 || this.state.tasks.length > 0);
      const serverHasData = (serverData && !serverData.empty && (Array.isArray(serverData.courses) || Array.isArray(serverData.tasks)));

      // اگر سرور داده دارد و تاریخ به‌روزرسانی سرور جدیدتر از تغییرات محلی است
      if (serverHasData && (serverUpdatedAt > lastLocalUpdate || !localHasData)) {
        this.db.suppressTouch = true;
        await this.db.clearAllStores();
        if (Array.isArray(serverData.semesters)) for (const x of serverData.semesters) await this.db.put('semesters', x);
        if (Array.isArray(serverData.courses)) for (const x of serverData.courses) await this.db.put('courses', x);
        if (Array.isArray(serverData.resources)) for (const x of serverData.resources) await this.db.put('resources', x);
        if (Array.isArray(serverData.tasks)) for (const x of serverData.tasks) await this.db.put('tasks', x);
        if (Array.isArray(serverData.assessments)) for (const x of serverData.assessments) await this.db.put('assessments', x);
        if (Array.isArray(serverData.mastery)) for (const x of serverData.mastery) await this.db.put('mastery', x);
        if (Array.isArray(serverData.forest)) for (const x of serverData.forest) await this.db.put('forest', x);
        this.db.suppressTouch = false;

        if (serverData.preferences) {
          localStorage.setItem('planner_preferences', JSON.stringify(serverData.preferences));
          this.state.preferences = serverData.preferences;
        }

        localStorage.setItem('planner_last_local_update', String(serverUpdatedAt || Date.now()));
        await this.reloadStateFromDB();
        this.renderCurrentView();
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
        if (!silent) this.showToast('داده‌های تحصیلی جدیدتر از سرور شبکه محلی بازیابی و همگام شدند.', 'success');
        return;
      }

      // در غیر این صورت (اگر داده محلی جدیدتر است یا سرور خالی است)، داده‌های محلی به سرور ارسال می‌شوند
      const nowIso = new Date().toISOString();
      const payload = {
        updatedAt: nowIso,
        todayJalali: JalaliDateEngine.todayJalali(),
        semesters: this.state.semesters,
        courses: this.state.courses,
        resources: this.state.resources,
        tasks: this.state.tasks,
        assessments: this.state.assessments,
        mastery: this.state.mastery,
        forest: this.state.forest || [],
        preferences: this.state.preferences
      };

      const postRes = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });

      if (!postRes.ok) throw new Error(`HTTP ${postRes.status}`);
      localStorage.setItem('planner_last_local_update', String(new Date(nowIso).getTime()));
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      if (!silent) this.showToast('همگام‌سازی دوطرفه با سرور شبکه محلی با موفقیت انجام شد.', 'success');
    } catch (err) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      if (!silent) {
        this.showToast('سرور شبکه محلی در دسترس نیست. برای همگام‌سازی، فایل run.bat یا دستور python serve.py را اجرا فرمایید.', 'warning');
      }
    }
  }
}

// مقداردهی اولیه نرم‌افزار
window.app = new GraduatePlannerApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
