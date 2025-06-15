const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test user management functionality
async function testUserManagement() {
    console.log('🧪 Testing User Management System...\n');

    try {
        // Test 1: Login as admin
        console.log('1. Testing admin login...');
        const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'admin@company.com',
            password: 'admin123'
        });
        const adminToken = adminLogin.data.token;
        console.log('✅ Admin login successful');

        // Test 2: Login as IT Manager
        console.log('\n2. Testing IT Manager login...');
        const itLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'it.manager@company.com',
            password: 'it123'
        });
        const itToken = itLogin.data.token;
        console.log('✅ IT Manager login successful');

        // Test 3: Login as Operations Manager
        console.log('\n3. Testing Operations Manager login...');
        const opsLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'operations.manager@company.com',
            password: 'ops123'
        });
        const opsToken = opsLogin.data.token;
        console.log('✅ Operations Manager login successful');

        // Test 4: Login as HR Employee (should have limited access)
        console.log('\n4. Testing HR Employee login...');
        const hrLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'hr.employee@company.com',
            password: 'hr123'
        });
        const hrToken = hrLogin.data.token;
        console.log('✅ HR Employee login successful');

        // Test 5: Admin can view all users
        console.log('\n5. Testing admin user list access...');
        const adminUsers = await axios.get(`${BASE_URL}/api/users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`✅ Admin can view ${adminUsers.data.data.users.length} users`);

        // Test 6: IT Manager can view all users
        console.log('\n6. Testing IT Manager user list access...');
        const itUsers = await axios.get(`${BASE_URL}/api/users`, {
            headers: { Authorization: `Bearer ${itToken}` }
        });
        console.log(`✅ IT Manager can view ${itUsers.data.data.users.length} users`);

        // Test 7: HR Employee cannot view user list
        console.log('\n7. Testing HR Employee user list access (should fail)...');
        try {
            await axios.get(`${BASE_URL}/api/users`, {
                headers: { Authorization: `Bearer ${hrToken}` }
            });
            console.log('❌ HR Employee should not have access to user list');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ HR Employee correctly denied access to user list');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Get a user ID for testing (HR employee)
        const hrUserId = adminUsers.data.data.users.find(u => u.email === 'hr.employee@company.com')._id;

        // Test 8: Admin can change password
        console.log('\n8. Testing admin password change...');
        await axios.put(`${BASE_URL}/api/users/${hrUserId}/password`, {
            newPassword: 'newhr123'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin can change user password');

        // Test 9: IT Manager can change password
        console.log('\n9. Testing IT Manager password change...');
        await axios.put(`${BASE_URL}/api/users/${hrUserId}/password`, {
            newPassword: 'newhr456'
        }, {
            headers: { Authorization: `Bearer ${itToken}` }
        });
        console.log('✅ IT Manager can change user password');

        // Test 10: Operations Manager can change password
        console.log('\n10. Testing Operations Manager password change...');
        await axios.put(`${BASE_URL}/api/users/${hrUserId}/password`, {
            newPassword: 'newhr789'
        }, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('✅ Operations Manager can change user password');

        // Test 11: HR Employee cannot change password
        console.log('\n11. Testing HR Employee password change (should fail)...');
        try {
            await axios.put(`${BASE_URL}/api/users/${hrUserId}/password`, {
                newPassword: 'shouldnotwork'
            }, {
                headers: { Authorization: `Bearer ${hrToken}` }
            });
            console.log('❌ HR Employee should not be able to change passwords');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ HR Employee correctly denied password change access');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Test 12: IT Manager can suspend user
        console.log('\n12. Testing IT Manager user suspension...');
        await axios.post(`${BASE_URL}/api/users/${hrUserId}/suspend`, {
            reason: 'Testing suspension by IT Manager',
            endDate: '2024-12-31'
        }, {
            headers: { Authorization: `Bearer ${itToken}` }
        });
        console.log('✅ IT Manager can suspend user');

        // Test 13: Operations Manager can unsuspend user
        console.log('\n13. Testing Operations Manager user unsuspension...');
        await axios.post(`${BASE_URL}/api/users/${hrUserId}/unsuspend`, {}, {
            headers: { Authorization: `Bearer ${opsToken}` }
        });
        console.log('✅ Operations Manager can unsuspend user');

        // Test 14: HR Employee cannot suspend user
        console.log('\n14. Testing HR Employee user suspension (should fail)...');
        try {
            await axios.post(`${BASE_URL}/api/users/${hrUserId}/suspend`, {
                reason: 'Should not work'
            }, {
                headers: { Authorization: `Bearer ${hrToken}` }
            });
            console.log('❌ HR Employee should not be able to suspend users');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ HR Employee correctly denied suspension access');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Test 15: Only admin can change user status (activate/deactivate)
        console.log('\n15. Testing admin user status change...');
        await axios.put(`${BASE_URL}/api/users/${hrUserId}/status`, {
            isActive: false
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin can change user status');

        // Reactivate the user
        await axios.put(`${BASE_URL}/api/users/${hrUserId}/status`, {
            isActive: true
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        // Test 16: IT Manager cannot change user status
        console.log('\n16. Testing IT Manager user status change (should fail)...');
        try {
            await axios.put(`${BASE_URL}/api/users/${hrUserId}/status`, {
                isActive: false
            }, {
                headers: { Authorization: `Bearer ${itToken}` }
            });
            console.log('❌ IT Manager should not be able to change user status');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ IT Manager correctly denied status change access');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Test 17: Test user statistics access
        console.log('\n17. Testing user statistics access...');
        const stats = await axios.get(`${BASE_URL}/api/users/stats/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`✅ Admin can view user statistics: ${stats.data.data.overview.total} total users`);

        // Test 18: IT Manager cannot access statistics
        console.log('\n18. Testing IT Manager statistics access (should fail)...');
        try {
            await axios.get(`${BASE_URL}/api/users/stats/dashboard`, {
                headers: { Authorization: `Bearer ${itToken}` }
            });
            console.log('❌ IT Manager should not have access to statistics');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('✅ IT Manager correctly denied statistics access');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        console.log('\n🎉 All user management tests completed successfully!');
        console.log('\n📋 Summary of permissions:');
        console.log('👑 Admin: Full access (view users, change passwords, suspend/unsuspend, change status, view stats)');
        console.log('🔧 IT Manager: View users, change passwords, suspend/unsuspend users');
        console.log('⚙️  Operations Manager: View users, change passwords, suspend/unsuspend users');
        console.log('👥 Other employees: Limited access (cannot manage users)');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
    }
}

// Run tests
testUserManagement();
