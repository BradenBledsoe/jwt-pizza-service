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
    if (process.env.VSCODE_INSPECTOR_OPTIONS) {
        jest.setTimeout(60 * 1000 * 5); // 5 minutes
    }
});

test("getUser", async () => {
    const getUserRes = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${testUserAuthToken}`);
    expect(getUserRes.status).toBe(200);

    const expectedUser = { ...adminUser, roles: [{ role: "admin" }] };
    delete expectedUser.password;
    expect(getUserRes.body).toMatchObject(expectedUser);
});

test("delete user as admin", async () => {
    const newUser = {
        name: randomName(),
        email: randomName() + "@test.com",
        password: "deleteme123",
        roles: [],
    };
    const createdUser = await DB.addUser(newUser);

    const deleteRes = await request(app)
        .delete(`/api/user/${createdUser.id}`)
        .set("Authorization", "Bearer " + testUserAuthToken);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toMatchObject({ message: "remove user successful" });

    await expect(DB.getUser(createdUser.email, "deleteme123")).rejects.toThrow(
        "unknown user"
    );
});

test("updateUser", async () => {
    const updatedUserRes = await request(app)
        .put(`/api/user/${adminUser.id}`)
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(adminUser);
    expect(updatedUserRes.status).toBe(200);
    expectValidJwt(updatedUserRes.body.token);

    const expectedUser = { ...adminUser, roles: [{ role: "admin" }] };
    delete expectedUser.password;
    expect(updatedUserRes.body.user).toMatchObject(expectedUser);
});

test("list users unauthorized", async () => {
    const listUsersRes = await request(app).get("/api/user");
    expect(listUsersRes.status).toBe(401);
});

test("list users as admin", async () => {
    const listUsersRes = await request(app)
        .get("/api/user")
        .set("Authorization", "Bearer " + testUserAuthToken);

    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users.length).toBeGreaterThan(0);
    expect(listUsersRes.body.users[0]).toHaveProperty("email");
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(
        /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
    );
}
