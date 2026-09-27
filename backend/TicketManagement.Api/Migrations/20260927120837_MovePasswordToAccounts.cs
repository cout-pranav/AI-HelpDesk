using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MovePasswordToAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Accounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Accounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_UserId_Provider",
                table: "Accounts",
                columns: new[] { "UserId", "Provider" },
                unique: true);

            // Move existing password hashes into credential accounts before dropping the column.
            migrationBuilder.Sql(
                "INSERT INTO Accounts (UserId, Provider, PasswordHash, CreatedAt) " +
                "SELECT Id, 'credential', PasswordHash, CreatedAt FROM Users WHERE PasswordHash <> ''");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(
                "UPDATE u SET PasswordHash = a.PasswordHash FROM Users u " +
                "JOIN Accounts a ON a.UserId = u.Id AND a.Provider = 'credential' " +
                "WHERE a.PasswordHash IS NOT NULL");

            migrationBuilder.DropTable(
                name: "Accounts");
        }
    }
}
