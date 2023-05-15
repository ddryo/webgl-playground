// 必要なモジュールを読み込み
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

// DOM がパースされたことを検出するイベントを設定
window.addEventListener(
	'DOMContentLoaded',
	() => {
		// 制御クラスのインスタンスを生成
		const app = new App3();
		// 初期化
		app.init();
		// 描画
		app.render();
	},
	false
);

const getRadian = (deg) => {
	return (deg * Math.PI) / 180;
};

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
	// カメラの設定
	static get CAMERA_PARAM() {
		return {
			fovy: 80,
			aspect: window.innerWidth / window.innerHeight,
			near: 0.1,
			far: 50.0,
			x: 0.0,
			y: 15.0,
			z: 10.0,
			lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
		};
	}

	// レンダラーの設定
	static get RENDERER_PARAM() {
		return {
			clearColor: 0x333333, // レンダラーが背景をリセットする際に使われる背景色
			width: window.innerWidth,
			height: window.innerHeight,
		};
	}

	/**
	 * コンストラクタ
	 * @constructor
	 */
	constructor() {
		this.renderer; // レンダラ
		this.scene; // シーン
		this.camera; // カメラ
		this.controls; // オービットコントロール

		this.isDown1 = false; // キーの押下状態を保持するフラグ
		this.isDown2 = false; // キーの押下状態を保持するフラグ
		this.isDown3 = false; // キーの押下状態を保持するフラグ

		// タイマー
		this.timerCash = null;
		this.timer = 0;
		this.timerId = null;

		this.boxs = []; // BOXの配列
		this.BOX_CT = 120; // BOXの数

		this.fireLight = null; // 点光源

		// 再帰呼び出しのための this 固定
		this.render = this.render.bind(this);

		// リサイズイベント
		window.addEventListener(
			'resize',
			() => {
				this.renderer.setSize(window.innerWidth, window.innerHeight);
				this.camera.aspect = window.innerWidth / window.innerHeight;
				this.camera.updateProjectionMatrix();
			},
			false
		);

		// タイマー処理
		this.timerId = setInterval(() => {
			this.timer += 1;
			this.timerCash = this.timer;

			if (this.timer === 100) {
				clearInterval(this.timerId);
			}
		}, 500);
	}

	/**
	 * 初期化処理
	 */
	init() {
		// レンダラー
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor));
		this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
		const wrapper = document.querySelector('#webgl');
		wrapper.appendChild(this.renderer.domElement);

		// シーン
		this.scene = new THREE.Scene();

		// カメラ
		this.camera = new THREE.PerspectiveCamera(
			App3.CAMERA_PARAM.fovy,
			App3.CAMERA_PARAM.aspect,
			App3.CAMERA_PARAM.near,
			App3.CAMERA_PARAM.far
		);
		this.camera.position.set(App3.CAMERA_PARAM.x, App3.CAMERA_PARAM.y, App3.CAMERA_PARAM.z);
		this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

		// ディレクショナルライト（平行光源）
		// https://threejs.org/docs/index.html?q=DirectionalLight#api/en/lights/DirectionalLight
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
		directionalLight.position.set(0.0, 1.0, 0.0); // xyzでベクトル指定
		this.scene.add(directionalLight);

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xeeeeee, 1.0);
		this.scene.add(ambientLight);

		// 点光源
		// https://threejs.org/docs/index.html?q=PointLight#api/en/lights/PointLight
		// memo: 公式ドキュメントを読むと、 decay (光の減衰率) はあまり指定しないほうがよさそう？
		this.fireLight = new THREE.PointLight(0xff0f0f, 5, 5);
		// pointLight.castShadow = true; // 影を落とす設定。（高負荷）

		// 照明を可視化するヘルパー
		// this.scene.add(new THREE.PointLightHelper(this.fireLight));

		// boxグループを保存する配列
		this.boxGroups = [];

		// const BOX_CT = 120;
		const boxGeometry = new THREE.BoxGeometry(1.0, 0.5, 0.8);
		// const group = new THREE.Group();

		// 要素ごとの角度の増加値 θ[deg]
		const INCREMENT_DEG = 1080 / this.BOX_CT;

		// それを radian に変換 ( rad = deg * (π / 180) )
		const INCREMENT_RAD = getRadian(INCREMENT_DEG);

		this.greenMaterial = new THREE.MeshStandardMaterial({
			color: new THREE.Color('#30ee20'),
		});
		this.redMaterial = new THREE.MeshPhongMaterial({
			color: new THREE.Color('#ff6565'),
		});
		this.grayMaterial = new THREE.MeshPhongMaterial({
			color: new THREE.Color('#ddd'),
			shininess: 0,
			wireframe: true,
		});

		// 蚊取り線香上にBOXを配置する
		for (let i = 0; i < this.BOX_CT; i++) {
			// Mesh生成 materialを個別に操作していきたいときは個別にmaterial定義しておかないといけないっぽい？
			const theMaterial = i === this.BOX_CT - 1 ? this.redMaterial : this.greenMaterial;
			const mesh = new THREE.Mesh(boxGeometry, theMaterial);

			const start_rad = 0.8; // 最初に映る蚊取り線香の向きを調整するための初期角度
			const base_rad = i * INCREMENT_RAD; // 基本の配置角度（個数で均等に割った値）

			// this.BOX_CT/2 で 0 、それ以下で正の値、それ以上で負の方向へ増加
			const offset_rad = (this.BOX_CT / 2 - i) * 0.001; // 20 個目より内側は角度間隔を広く、外側は角度を狭くする
			console.log('offset_rad:' + offset_rad);
			const _rad = start_rad + base_rad + offset_rad; // 20 個目より内側は角度間隔を広く、外側は角度を狭くする
			console.log('_rad' + _rad);
			const _r = 1 + i * 0.05; // なんかいい感じに渦が広がるように半径を調整

			// 配置座標を 角度[rad] と 半径r から計算して配置
			const x = _r * Math.cos(_rad);
			const z = _r * Math.sin(_rad);
			mesh.position.set(x, 0, z);
			mesh.rotation.y = -_rad;
			mesh.scale.z = 1.0 - (this.BOX_CT / 2 - i) * 0.005;

			// グループに追加する
			// group.add(mesh);
			this.scene.add(mesh);
			this.boxs.push(mesh);

			// 最後の位置に合わせてライトを配置
			this.fireLight.position.set(x, 0.2, z);
			this.scene.add(this.fireLight);
		}

		// グループをシーンに追加する
		// this.scene.add(group);

		// 床
		// PlaneGeometry
		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(100, 100),
			new THREE.MeshPhongMaterial({
				color: 0x333333,
				transparent: true,
				opacity: 0.5,
			})
		);
		plane.position.set(0, -0.35, 0);
		plane.rotation.x = getRadian(-90);
		this.scene.add(plane);

		// OrbitControls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// 軸ヘルパー
		// this.scene.add(new THREE.AxesHelper(10.0));
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループの設定
		requestAnimationFrame(this.render);

		// タイマーが進むごとに色を変えていく（マテリアルの入れ替え）
		if (null !== this.timerCash) {
			this.timerCash = null;
			const targetRed = this.boxs[this.BOX_CT - this.timer - 1];
			const targetGray = this.boxs[this.BOX_CT - this.timer];

			if (targetRed) {
				targetRed.material = this.redMaterial;

				this.fireLight.position.set(targetRed.position.x, 0.2, targetRed.position.z);
			}

			if (targetGray) {
				targetGray.material = this.grayMaterial;
			}
		}

		// レンダラーで描画
		this.renderer.render(this.scene, this.camera);
	}
}
