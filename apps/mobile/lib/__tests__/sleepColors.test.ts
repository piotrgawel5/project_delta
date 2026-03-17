import { getSleepScoreGrade } from '../sleepColors';

describe('getSleepScoreGrade', () => {
  it('returns the expected grade bucket boundaries', () => {
    expect(getSleepScoreGrade(100)).toMatchObject({ grade: 'Excellent', color: '#7937E3' });
    expect(getSleepScoreGrade(90)).toMatchObject({ grade: 'Excellent', color: '#7937E3' });
    expect(getSleepScoreGrade(89)).toMatchObject({ grade: 'Great', color: '#139645' });
    expect(getSleepScoreGrade(80)).toMatchObject({ grade: 'Great', color: '#139645' });
    expect(getSleepScoreGrade(79)).toMatchObject({ grade: 'Good', color: '#436111' });
    expect(getSleepScoreGrade(70)).toMatchObject({ grade: 'Good', color: '#436111' });
    expect(getSleepScoreGrade(69)).toMatchObject({ grade: 'Fair', color: '#F48414' });
    expect(getSleepScoreGrade(60)).toMatchObject({ grade: 'Fair', color: '#F48414' });
    expect(getSleepScoreGrade(59)).toMatchObject({ grade: 'Poor', color: '#FF304E' });
    expect(getSleepScoreGrade(50)).toMatchObject({ grade: 'Poor', color: '#FF304E' });
    expect(getSleepScoreGrade(49)).toMatchObject({ grade: 'Bad', color: '#CD0A24' });
    expect(getSleepScoreGrade(40)).toMatchObject({ grade: 'Bad', color: '#CD0A24' });
    expect(getSleepScoreGrade(39)).toMatchObject({ grade: 'Terrible', color: '#C01010' });
    expect(getSleepScoreGrade(0)).toMatchObject({ grade: 'Terrible', color: '#C01010' });
  });

  it('returns N/A for out-of-range values', () => {
    expect(getSleepScoreGrade(-1)).toMatchObject({ grade: 'N/A', color: '#000000' });
    expect(getSleepScoreGrade(101)).toMatchObject({ grade: 'N/A', color: '#000000' });
  });
});
