import * as fs from 'fs'
import { v4 } from "uuid"
import * as firebase from '@firebase/rules-unit-testing'

// Firebase JS SDKのserverTimestampを使う
import { serverTimestamp as st} from 'firebase/firestore'
const serverTimestamp = () => st()

// rules-unit-testingについてくる firebase/compat のほうを使っても良い
// import firebaseApp from 'firebase/compat'
// const serverTimestamp = () => firebaseApp.firestore.FieldValue.serverTimestamp()

const projectID = v4()
let testEnv: firebase.RulesTestEnvironment

beforeAll(async () => {
  // テストプロジェクト環境の作成
  testEnv = await firebase.initializeTestEnvironment({
    projectId: projectID,
    firestore: {
      rules: fs.readFileSync('./firestore.rules', 'utf8')
    }
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('users collection', () => {
  it('create: 自身のドキュメントなら作成できる', async () => {
    const uid = v4()
    const context = testEnv.authenticatedContext(uid)
    await firebase.assertSucceeds(
      context.firestore().doc(`users/${uid}`).set({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
  })

  it('create: 他人のドキュメントには作成できない', async () => {
    // 別人としてcontextを作成
    const context = testEnv.authenticatedContext(v4())

    const uid = v4()
    await firebase.assertFails(
      context.firestore().doc(`users/${uid}`).set({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
  })

  it('create: 未認証だと作成できない', async () => {
    const context = testEnv.unauthenticatedContext()
    await firebase.assertFails(
      context.firestore().doc(`users/${v4()}`).set({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )
  })

  it('update: 自分のデータは編集できる', async () => {
    const uid = v4()

    // データの事前準備はルール向こうのコンテキストを使って行う
    await testEnv.withSecurityRulesDisabled(async context => {
      await context.firestore().doc(`users/${uid}`).set({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    const context = testEnv.authenticatedContext(uid)
    await firebase.assertSucceeds(
      context.firestore().doc(`users/${uid}`).set({
        updatedAt: serverTimestamp(),
      }, { merge: true })
    )
  })
})
