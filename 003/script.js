// 必要なモジュールを読み込み
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { getRadian } from './helper/getRadian.js';

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
			y: 0.0,
			z: 20.0,
			lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
		};
	}

	// レンダラーの設定
	static get RENDERER_PARAM() {
		return {
			clearColor: 0x222222, // レンダラーが背景をリセットする際に使われる背景色
			width: window.innerWidth,
			height: window.innerHeight,
		};
	}

	/**
	 * コンストラクタ
	 * @constructor
	 */
	constructor() {
		this.cameraRad = 0;
		this.renderer; // レンダラ
		this.scene; // シーン
		this.camera; // カメラ
		// this.boxGroups; // BOXメッシュの配列
		this.controls; // オービットコントロール

		this.topGroup;

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
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
		directionalLight.position.set(1.0, 1.0, 2.0); // xyzでベクトル指定

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);

		// 点光源
		// https://threejs.org/docs/index.html?q=PointLight#api/en/lights/PointLight
		// memo: 公式ドキュメントを読むと、 decay (光の減衰率) はあまり指定しないほうがよさそう？
		const pointLight = new THREE.PointLight(0xbb99ee, 0.5, 50);
		pointLight.position.set(0, 0, 0);
		// pointLight.castShadow = true; // 影を落とす設定。（高負荷）

		// 各ライトをシーンに追加
		this.scene.add(directionalLight);
		this.scene.add(ambientLight);
		this.scene.add(pointLight);

		// 照明を可視化するヘルパー
		// this.scene.add(new THREE.PointLightHelper(pointLight));

		// boxグループを保存する配列
		// this.boxGroups = [];

		const boxGeometry = new THREE.BoxGeometry(0.1, 1.0, 1.0);

		const boxCt = 20; // BOXの個数
		const groupCt = 20; // BOXグループの個数
		const r = 5.0; // BOXを配置する円周の半径

		// 360度をBox数で割ることで、BOX間の配置角度を計算
		const INCREMENT_RAD_BOX = getRadian(360 / boxCt);

		// 360度をグループ数で割ることで、グループ間の回転角度を計算
		const INCREMENT_RAD_GROUP = getRadian(360 / groupCt);

		// マテリアル
		const material = new THREE.MeshStandardMaterial({
			color: 0x5599ff,
			roughness: 0.5,
			metalness: 0.8,
			// wireframe: true,
		});

		// 複数のグループをまとめるためのグループ
		this.topGroup = new THREE.Group();

		// 同一円周上のBOXたちをグループ化するためのもの
		const group = new THREE.Group();

		// 指定された個数のBOXの座標をそれぞれ計算してGrupに追加する
		for (let i = 0; i < boxCt; i++) {
			// Mesh生成
			const mesh = new THREE.Mesh(boxGeometry, material);

			// 配置座標を 角度[rad] と 半径r から計算し、xy平面上に配置
			const x = r * Math.cos(i * INCREMENT_RAD_BOX);
			const y = r * Math.sin(i * INCREMENT_RAD_BOX);
			mesh.position.set(x, y, 0);

			mesh.rotation.z = i * INCREMENT_RAD_BOX;

			// グループに追加する
			group.add(mesh);
		}

		// グループをトップグループに追加する
		this.topGroup.add(group);

		for (let i = 0; i < groupCt; i++) {
			const clonedGroup = group.clone(true);
			console.log(clonedGroup);
			clonedGroup.rotation.y = i * INCREMENT_RAD_GROUP;
			this.topGroup.add(clonedGroup);
		}

		// トップグループをシーンに追加する
		this.scene.add(this.topGroup);

		// カメラ操作チャレンジ
		// this.cameraRad = 1;
		// const cameraR = 20;
		// const x = cameraR * Math.cos(this.cameraRad);
		// const z = cameraR * Math.sin(this.cameraRad);
		// this.camera.position.set(x, 10, z);
		// this.camera.rotation.order = 'XYZ'; // ?
		// this.camera.rotation.x = 0.5; //this.cameraRad;

		// キー操作できるようにグループを配列に保存しておく
		// this.boxGroups.push({ group, perspective, r });

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

		// コントロールを更新 memo: なくても動いた
		// this.controls.update();

		this.topGroup.rotation.y += 0.001;

		// レンダラーで描画
		this.renderer.render(this.scene, this.camera);
	}
}
