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
			y: 10.0,
			z: 20.0,
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
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(0.0, 1.0, 0.0); // xyzでベクトル指定

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

		// 各ライトをシーンに追加
		this.scene.add(directionalLight);
		this.scene.add(ambientLight);

		// boxグループを保存する配列
		this.boxGroups = [];

		const BOX_CT = 100;
		const boxGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
		// const group = new THREE.Group();

		// 要素ごとの角度の増加値 θ[deg]
		const INCREMENT_DEG = (360 * 2.5) / BOX_CT;

		// それを radian に変換 ( rad = deg * (π / 180) )
		const INCREMENT_RAD = (INCREMENT_DEG * Math.PI) / 180;

		// 蚊取り線香上にBOXを配置する
		for (let i = 0; i < BOX_CT; i++) {
			// Mesh生成 materialを個別に操作していきたいときは個別にmaterial定義しておかないといけないっぽい？
			const mesh = new THREE.Mesh(
				boxGeometry,
				new THREE.MeshStandardMaterial({ color: i === 99 ? 0xff0000 : 0x66ee22 })
			);

			const offset_rad = 4; // 最初に映る蚊取り線香の向きを調整するためのオフセット
			const _rad = offset_rad + (i * INCREMENT_RAD + (i - 20) * 0.02); // 中心は角度を広く、外側は角度を狭くする
			const _r = 1 + 0.01 * i + i * 0.05; // なんかいい感じに渦が広がるように半径を調整

			// 配置座標を 角度[rad] と 半径r から計算して配置
			const x = _r * Math.cos(_rad);
			const z = _r * Math.sin(_rad);
			mesh.position.set(x, 0, z);

			// グループに追加する
			// group.add(mesh);
			this.scene.add(mesh);
			this.boxs.push(mesh);
		}

		// グループをシーンに追加する
		// this.scene.add(group);

		// OrbitControls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// 軸ヘルパー
		// this.scene.add(new THREE.AxesHelper(5.0));
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループの設定
		requestAnimationFrame(this.render);

		// タイマーが進むごとに色を変えていく
		if (null !== this.timerCash) {
			console.log(this.timer);
			this.timerCash = null;
			const targetRed = this.boxs[99 - this.timer];
			const targetGray = this.boxs[99 - this.timer + 1];

			if (targetRed) {
				targetRed.material.color = new THREE.Color('red');
			}

			if (targetGray) {
				targetGray.material.color = new THREE.Color('#ccc');
				targetGray.material.wireframe = true;
			}
		}

		// レンダラーで描画
		this.renderer.render(this.scene, this.camera);
	}
}
