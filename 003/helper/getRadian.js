// deg : radian に変換したい角度 θ[deg]
// 計算式 : rad = deg * (π / 180)
export const getRadian = (deg) => {
	return (deg * Math.PI) / 180;
};
