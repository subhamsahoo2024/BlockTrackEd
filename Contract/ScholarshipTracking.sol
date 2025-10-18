// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ScholarshipTracking is Ownable, ReentrancyGuard {
    enum Status { Pending, Verified, Rejected, Disbursed }

    struct Fund {
        uint amount;           // total fund amount allocated at creation
        uint remaining;        // remaining amount available for approvals/disbursements
        string criteria;       // eligibility criteria (human-readable)
        uint deadline;         // application deadline (unix timestamp)
        bool isActive;         // whether fund is active
    }

    struct Application {
        uint fundId;           // which fund student applied for
        string firstName;
        string lastName;
        string email;
        uint cgpa;
        string major;
        Status status;
        uint amountApproved;   // amount reserved/approved for this application
        address student;       // applicant's address
    }

    struct SchoolAccount{
        string schoolName;
        address schoolAddress;
    }

    uint public fundCount;
    mapping(uint => Fund) public scholarshipFunds;                // fundId => Fund
    mapping(address => Application[]) public studentApplications; // student address => applications[]
    mapping(address => bool) public everAdded;
    mapping(address => bool) public isSchool;   // authorized school addresses
    SchoolAccount[] public schoolAccounts;            // list of schools (for UI)

    /* Events */
    event FundCreated(uint indexed fundId, uint amount, uint deadline);
    event FundDeactivated(uint indexed fundId);
    event StudentApplied(address indexed student, uint indexed fundId, uint appIndex);
    event StudentApproved(address indexed school, address indexed student, uint indexed appIndex, uint amount);
    event StudentRejected(address indexed school, address indexed student, uint indexed appIndex);
    event FundDisbursed(address indexed student, uint indexed appIndex, uint amount);
    event Deposit(address indexed from, uint amount);
    event SchoolAdded(address indexed school);
    event SchoolRemoved(address indexed school);

    /* Modifiers */
    modifier onlySchool() {
        require(isSchool[msg.sender], "Only school allowed");
        _;
    }

    constructor() Ownable(msg.sender) {
        // owner (admin) set via Ownable constructor (msg.sender)
    }

    // ---------------- ADMIN (owner) FUNCTIONS ---------------- //

    // Add a school address that can verify applications
    function addSchool(string memory schoolname, address schoolAddr) external onlyOwner {
        require(schoolAddr != address(0), "Invalid address");
        require(bytes(schoolname).length !=0,"School Name field is empty");
        require(!isSchool[schoolAddr], "This School is already active");
        isSchool[schoolAddr] = true;
        if (!everAdded[schoolAddr]) {
            schoolAccounts.push(SchoolAccount({
                schoolAddress: schoolAddr,
                schoolName: schoolname}));
            everAdded[schoolAddr] = true;
        }
        emit SchoolAdded(schoolAddr);
    }


    // Remove a school . Does not remove from array to save gas; UI can filter.
    function removeSchool(address schoolAddr) external onlyOwner {
        require(isSchool[schoolAddr], "Not a school");
        isSchool[schoolAddr] = false;
        emit SchoolRemoved(schoolAddr);
    }

    // Create a new scholarship fund. `amount` should be deposited into contract separately or by calling deposit() beforehand.
    function createFund(uint _amount, string calldata _criteria, uint _deadline) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be future");

        fundCount += 1;
        scholarshipFunds[fundCount] = Fund({
            amount: _amount,
            remaining: _amount,
            criteria: _criteria,
            deadline: _deadline,
            isActive: true
        });

        emit FundCreated(fundCount, _amount, _deadline);
    }

    // Deactivate a fund so no more applications/approvals are allowed
    function deactivateFund(uint _fundId) external onlyOwner {
        Fund storage f = scholarshipFunds[_fundId];
        require(f.isActive, "Already inactive or not exist");
        f.isActive = false;
        emit FundDeactivated(_fundId);
    }

    // Trigger disbursement for a specific student's application .
    function triggerDisbursement(address payable _student, uint _appIndex) external onlyOwner nonReentrant {
        require(_student != address(0), "Invalid student");
        Application storage app = studentApplications[_student][_appIndex];
        require(app.student == _student, "Application mismatch");
        require(app.status == Status.Verified, "Application not verified");
        require(app.amountApproved > 0, "No amount approved");
        require(address(this).balance >= app.amountApproved, "Insufficient contract balance");

        // Mark as disbursed first (checks-effects-interactions)
        app.status = Status.Disbursed;
        Fund storage fund = scholarshipFunds[app.fundId];
        fund.remaining -= app.amountApproved;  // Deduct from fund
        // Transfer with call and check success
        (bool sent, ) = _student.call{value: app.amountApproved}("");
        require(sent, "Transfer failed");

        emit FundDisbursed(_student, _appIndex, app.amountApproved);
    }

    // Owner can deposit ETH into contract to fund disbursements.
    function deposit() external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        emit Deposit(msg.sender, msg.value);
    }
    // Owner can withdraw accidental ETH sent to contract.
    function withdrawAccidentalETH(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(_amount);
    }
    // ---------------- SCHOOL FUNCTIONS ---------------- //

    // School approves a student's application and reserves the amount from fund.remaining
    function approveStudent(address _student, uint _appIndex, uint _amount) external onlySchool {
        require(_student != address(0), "Invalid student");
        Application storage app = studentApplications[_student][_appIndex];
        require(app.student == _student, "Application mismatch");
        require(app.status == Status.Pending, "Already processed");
        Fund storage f = scholarshipFunds[app.fundId];
        require(f.isActive, "Fund inactive");
        require(block.timestamp <= f.deadline, "Fund deadline passed");
        require(_amount > 0, "Amount must be > 0");
        require(f.remaining >= _amount, "Not enough remaining in fund");

        // Reserve amount
        f.remaining -= _amount;

        app.status = Status.Verified;
        app.amountApproved = _amount;

        emit StudentApproved(msg.sender, _student, _appIndex, _amount);
    }

    // School rejects a student's application. Only Pending apps can be rejected.
    function rejectStudent(address _student, uint _appIndex) external onlySchool {
        require(_student != address(0), "Invalid student");
        Application storage app = studentApplications[_student][_appIndex];
        require(app.student == _student, "Application mismatch");
        require(app.status == Status.Pending, "Already processed");

        app.status = Status.Rejected;

        emit StudentRejected(msg.sender, _student, _appIndex);
    }

    // ---------------- STUDENT FUNCTIONS ---------------- //

    // Student applies to a specific fund. Schools will verify off-chain and then call approve/reject.
    function applyForScholarship(
        uint _fundId,
        string calldata _firstName,
        string calldata _lastName,
        string calldata _email,
        uint _cgpa,
        string calldata _major
    ) external {
        Fund storage f = scholarshipFunds[_fundId];
        require(f.isActive, "Fund inactive or not exist");
        require(block.timestamp <= f.deadline, "Deadline passed");

        Application memory app = Application({
            fundId: _fundId,
            firstName: _firstName,
            lastName: _lastName,
            email: _email,
            cgpa: _cgpa,
            major: _major,
            status: Status.Pending,
            amountApproved: 0,
            student: msg.sender
        });

        studentApplications[msg.sender].push(app);
        uint idx = studentApplications[msg.sender].length - 1;
        emit StudentApplied(msg.sender, _fundId, idx);
    }

    // ---------------- VIEW / HELPERS ---------------- //

    // Return a single application for a student by index
    function getApplication(address _student, uint _index) external view returns (Application memory) {
        return studentApplications[_student][_index];
    }

    // Return the applications count for a student
    function getApplicationsCount(address _student) external view returns (uint) {
        return studentApplications[_student].length;
    }

    // Return list of school addresses
    function getSchoolList() external view returns (SchoolAccount[] memory) {
        return schoolAccounts;
    }

    // Get fund details
    function getFundDetails(uint _fundId) external view returns (Fund memory) {
        return scholarshipFunds[_fundId];
    }

    // Get contract ETH balance
    function getContractBalance() public view returns (uint) {
        return address(this).balance;
    }

    // ---------------- ETH RECEIVING ---------------- //

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
}
