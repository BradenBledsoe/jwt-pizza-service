const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

let adminUser;
let testUserAuthToken;

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

    // cleanup
    await request(app)
        .delete(`/api/franchise/${res.body.id}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);
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

    // cleanup store + franchise
    await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeRes.body.id}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);
    await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);
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

    // cleanup
    await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`);
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(
        /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
    );
}
