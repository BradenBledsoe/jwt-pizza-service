const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
    testUser.email = randomName() + "@test.com";
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUser.id = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);
});

test("getUser", async () => {
    const getUserRes = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(getUserRes.status).toBe(200);

    const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
    delete expectedUser.password;
    expect(getUserRes.body).toMatchObject(expectedUser);
});

test("updateUser", async () => {
    const updatedUserRes = await request(app)
        .put(`/api/user/${testUser.id}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(testUser);
    expect(updatedUserRes.status).toBe(200);
    expectValidJwt(updatedUserRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
    delete expectedUser.password;
    expect(updatedUserRes.body.user).toMatchObject(expectedUser);
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(
        /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
    );
}
