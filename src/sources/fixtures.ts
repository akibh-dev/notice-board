import type { Category, Notice } from '../lib/types';

/** Fake data so the UI can be built without hitting live sites (`npm run fetch:fixtures`). Dates are relative to today. */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const rows: [string, string, string, number, number | null, number | undefined, Category][] = [
  ['teletalk-alljobs', 'Assistant Engineer (Civil)', 'Roads and Highways Department', -2, 25, 12, 'job'],
  ['teletalk-alljobs', 'Sub-Assistant Engineer', 'LGED', -4, 3, 30, 'job'],
  ['teletalk-alljobs', 'Office Assistant cum Computer Typist', 'District Commissioner Office, Cumilla', -6, 14, 5, 'job'],
  ['teletalk-alljobs', 'Junior Instructor (Computer)', 'Directorate of Technical Education', -9, -1, 22, 'job'],
  ['teletalk-alljobs', 'Admit Card: Assistant Teacher Recruitment', 'DPE', -1, null, undefined, 'admit-card'],
  ['teletalk-alljobs', 'Result: Senior Staff Nurse Exam', 'DGHS', -3, null, undefined, 'result'],
  ['teletalk-alljobs', 'Driver (Light Vehicle)', 'Bangladesh Railway', -12, 8, 9, 'job'],
  ['teletalk-alljobs', 'Viva Schedule: Upazila Education Officer', 'MoPME', -5, null, undefined, 'exam'],
  ['teletalk-alljobs', 'Sub-Inspector (Unarmed Branch)', 'Bangladesh Police', -7, 40, 1500, 'job'],
  ['teletalk-alljobs', 'Cipher Assistant', 'Ministry of Foreign Affairs', -15, 1, 6, 'job'],
  ['bb-erecruitment', 'Assistant Director (General)', 'Bangladesh Bank', -3, 18, 40, 'job'],
  ['bb-erecruitment', 'Assistant Director (IT)', 'Bangladesh Bank', -3, 18, 15, 'job'],
  ['bb-erecruitment', 'Officer (Cash)', 'Bangladesh Bank', -20, -8, 100, 'job'],
  ['bb-erecruitment', 'Admit Card: Assistant Maintenance Engineer', 'Bangladesh Bank', 0, null, undefined, 'admit-card'],
  ['bb-erecruitment', 'Result: Joint Director (Law)', 'Bangladesh Bank', -10, null, undefined, 'result'],
  ['bb-erecruitment', 'Medical Officer', 'Bangladesh Bank', -1, 30, 3, 'job'],
  ['bb-erecruitment', 'Security Guard', 'Bangladesh Bank', -8, 6, 60, 'job'],
  ['bb-erecruitment', 'Notice: Written Exam Date Rescheduled', 'Bangladesh Bank', -2, null, undefined, 'other'],
];

export const fixtureNotices: Omit<Notice, 'id'>[] = rows.map(([sourceId, title, organization, pub, dl, vacancies, category], i) => ({
  sourceId,
  title,
  organization,
  url: `https://example.com/notice/${i + 1}`,
  publishedAt: day(pub),
  deadline: dl === null ? undefined : day(dl),
  vacancies,
  category,
}));
