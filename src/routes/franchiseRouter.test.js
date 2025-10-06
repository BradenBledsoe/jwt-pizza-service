const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

let adminUser;
let testUserAuthToken;

const createdFranchises = [];
const createdStores = [];

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + "@admin.com";

    user = await DB.addUser(user);
    return { ...user, password: "toomanysecrets" };
}

// Centralized cleanup after each test
afterEach(async () => {
    // Delete all created stores first
    for (const store of createdStores) {
        await request(app)
            .delete(`/api/franchise/${store.franchiseId}/store/${store.id}`)
            .set("Authorization", `Bearer ${testUserAuthToken}`);
    }
    createdStores.length = 0;

    // Delete all created franchises
    for (const franchiseId of createdFranchises) {
        await request(app)
            .delete(`/api/franchise/${franchiseId}`)
            .set("Authorization", `Bearer ${testUserAuthToken}`);
    }
    createdFranchises.length = 0;
});

beforeAll(async () => {
    adminUser = await createAdminUser();
    const loginRes = await request(app).put("/api/auth").send(adminUser);
    testUserAuthToken = loginRes.body.token;
    adminUser.id = loginRes.body.user.id;
    expectValidJwt(testUserAuthToken);
});

test("getFranchises", async () => {
    const res = await request(app)
        .get("/api/franchise?page=0&limit=10&name=*")
        .set("Authorization", `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body.franchises).toEqual(expect.any(Array));
});

test("createFranchise", async () => {
    const franchiseData = {
        name: "PizzaTest-" + randomName(),
        admins: [{ email: adminUser.email }],
    };

    const res = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(franchiseData);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        id: expect.any(Number),
        name: franchiseData.name,
        admins: [{ email: adminUser.email }],
    });

    createdFranchises.push(res.body.id); // track for cleanup
});

test("createStore", async () => {
    // create a franchise for this store
    const franchiseRes = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send({
            name: "StoreFranchise-" + randomName(),
            admins: [{ email: adminUser.email }],
        });

    const franchiseId = franchiseRes.body.id;
    createdFranchises.push(franchiseId);

    const storeData = { name: "StoreTest" };
    const storeRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(storeData);

    expect(storeRes.status).toBe(200);
    expect(storeRes.body).toMatchObject({
        id: expect.any(Number),
        name: "StoreTest",
    });

    createdStores.push({ id: storeRes.body.id, franchiseId }); // track for cleanup
});

test("deleteFranchise", async () => {
    // create a franchise to delete
    const franchiseRes = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send({
            name: "DeleteFranchise-" + randomName(),
            admins: [{ email: adminUser.email }],
        });

    const franchiseId = franchiseRes.body.id;

    const res = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "franchise deleted" });

    // do not add to createdFranchises since it's already deleted
});

test("getUserFranchises", async () => {
    // create a franchise with the adminUser as admin
    const franchiseRes = await request(app)
        .post("/api/franchise")
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send({
            name: "UserFranchise-" + randomName(),
            admins: [{ email: adminUser.email }],
        });

    const franchiseId = franchiseRes.body.id;
    createdFranchises.push(franchiseId);

    // call API to get user franchises
    const getUserFranchiseRes = await request(app)
        .get(`/api/franchise/${adminUser.id}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);

    expect(getUserFranchiseRes.status).toBe(200);

    // check that the returned array contains the franchise
    expect(getUserFranchiseRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                id: franchiseId,
                name: franchiseRes.body.name,
                admins: expect.any(Array),
                stores: expect.any(Array),
            }),
        ])
    );
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(
        /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
    );
}
