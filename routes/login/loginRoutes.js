const express = require('express');
const { getGyms, createGym, deleteGym } = require('../../controllers/login/gymControllers');
const { userNicknameExist } = require('../../controllers/login/loginControllers');
const router = express.Router();

// 미들웨어 - 인증 확인 (필요시 사용)
// const { authenticateToken } = require('../../middleware/auth');

router.get('/exist-nick', userNicknameExist);

router.get('/check-auth', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ isLoggedIn: true, user: req.user });
  } else {
    res.json({ isLoggedIn: false });
  }
});

router.post('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(); // 선택사항: 세션까지 제거
    res.clearCookie('connect.sid'); // 선택사항: 쿠키 삭제
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/gym',getGyms);
router.post('/gym',createGym);
router.delete('/gym/:gymId',deleteGym);
module.exports = router; 