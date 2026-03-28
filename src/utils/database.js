/**
 * Fausse base de données en mémoire pour le développement
 * À remplacer par PostgreSQL + ORM en production
 */

let users = [];
let nextId = 1;

function addUser(user) {
  user.id = nextId++;
  users.push(user);
  return user;
}

function getUserByEmail(email) {
  return users.find(u => u.email === email);
}

function getUserById(id) {
  return users.find(u => u.id === id);
}

function getAllUsers() {
  return [...users];
}

function clearUsers() {
  users = [];
  nextId = 1;
}

module.exports = {
  addUser,
  getUserByEmail,
  getUserById,
  getAllUsers,
  clearUsers,
};
