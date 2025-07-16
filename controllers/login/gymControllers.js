const { sendQuery } = require("../../config/database");

const gymNameExist = async (req, res)=>{
  const {gym_name} = req.query;
  const query = `select * from gym where gym = $1`;
  const values = [gym_name];
  try {
    const result = await sendQuery(query, values);
    res?.json({success:true, isExist:(result.length > 0)})
    return (result.length > 0);
  } catch (error) {
    console.log(error);
    res?.json({success:false});
  }
}

const deleteGym = async (req, res)=>{
  if (req.isAuthenticated() == false){
    return res.json({msg:"회원이 아닙니다.", success:false});
  }
  const {role} = req.user;
  if(role !== "ADMIN"){
    return res.json({msg:"권한 없음", success:false});
  }
  const {gymId} = req.params;
  const query = `delete from gym where gym_id = $1`;
  const values = [gymId];
  try {
    await sendQuery(query, values);
    res.json({msg:"delete",success:true})
  } catch (error) {
    res.json({msg:"error",success:false})
  }
}

const getGyms = async (req, res)=>{
  try {
    const gyms = await sendQuery(
      `select * from gym order by gym`
    )
    res.json({gyms:gyms, success:true});
  } catch (error) {
    console.log(error)
    res.json({success:false})
  }
}

const createGym = async (req, res) => {
  console.log(req.body);
  const {gym_name, gym_address} = req.body;
  try {
    const gyms = await sendQuery(`
      insert into gym(gym, gym_address) values($1, $2) returning *
      `,[gym_name, gym_address]);
    
    if(gyms.length == 0){
      return res.json({msg:"생성 실패", success:false});
    }
    res.json({gym:gyms[0], success:true});
  } catch (error) {
    console.log("createGyms Error : ",error);
    res.json({success:false})
  }
}

module.exports = {getGyms, createGym, gymNameExist, deleteGym};
