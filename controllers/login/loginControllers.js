const { sendQuery } = require("../../config/database");
const { uploadFileImage } = require("../common/fileControllers");

const userNicknameExist = async (req, res) =>{
  const {nick_name} = req.query;
  const query = `select * from "USER" where nick_name = $1`;
  const values = [nick_name];
  try {
    const nickNames = await sendQuery(query,values);
    if(nickNames.length > 0)
      res.json({isExist:true, success:true});
    else
      res.json({isExist:false, success:true});
  } catch (error) {
    console.log(error);
    res.json({success:false})
  }
}

const userRegister = async (req, profile, done)=>{
  const { id,displayName, emails, photos } = profile;
  const formData = req?.session?.oauthFormData;

  const profile_image = req.session.oauthProfileImage;
  const query = `
  INSERT INTO "USER" (
  USER_NAME,NICK_NAME,EMAIL,AGE,HEIGHT,WEIGHT,GENDER,ROLE,FIT_GOAL,FILE_ID,GYM_ID,FIT_HISTORY) VALUES (
  $1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11,$12
  ) RETURNING USER_ID, USER_NAME,NICK_NAME,EMAIL;
  `;

  if(formData.role !=="MEMBER" && formData.role !=="TRAINER"){
      return done(null, false, {message:"허가되지 않은 권한", success:false})
  }

  const values = [
      displayName,
      formData.nick_name,
      emails[0].value,
      formData.age,
      formData.height,
      formData.weight,
      formData.gender,
      formData.role,
      formData.goal,
      undefined, //기본 프로필 이미지 id
      formData.gymId,
      formData.history,
  ];
  console.log(values)
  try {
    const user = await sendQuery(query, values);
    // console.log(user);
    if(profile_image){
      const {userId} = user[0];
      const img_addr = await uploadFileImage([profile_image],userId);
      const fileId = img_addr.fileIdArr[0];
      // console.log(img_addr, userId);
      await sendQuery(`update "USER" set file_id = $1 where user_id = $2`,[fileId,userId])
    }
    

    return done(null, user[0]);
  } catch (error) {
    console.log("Error : ",error);
    return done(null,false, {message : '회원 가입 중 에러가 발생하였습니다.', success:false});
  }
}


module.exports = {userRegister,userNicknameExist};